"use client";

// E-xx evidence source viewer (port of design bundle concept-c-views.jsx).
// Shows the exact cited source extract with the passage highlighted, document
// metadata, extraction anchor, CP-5B trace status, and cited-by trail.

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { CloseButton } from "@/components/shared/CloseButton";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { EVIDENCE } from "@/lib/reports/evidence";
import { DOCS, DEBATE } from "@/lib/reports/deal";
import { MODULE_OUTPUTS } from "@/lib/deepdive/module-outputs";
import type { Report } from "@/lib/reports/builders";
import { FlagToQa } from "@/components/shared/FlagToQa";
import { getChunk } from "@/lib/api";
import type { LiveEvidence } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";

export { EvChip } from "./EvChip";

// lineage_class → resolved/flagged, mirroring adapt.ts lineageSev.
function liveStatus(lineageClass: string): "verified" | "open" {
  return ["Conflicting", "Weak Lineage", "Untraced", "Insufficient Information"]
    .includes(lineageClass) ? "open" : "verified";
}

function findCitations(id: string, reports: Report[]): string[] {
  const hits: string[] = [];
  DEBATE.rounds.forEach((r) =>
    r.points.forEach((p, i) => {
      if (p.ev.includes(id)) hits.push(`CP-6A · ${r.who} ${r.phase} · point ${i + 1}`);
    })
  );
  DEBATE.weighting.forEach((w) => {
    if (w.ev.includes(id)) hits.push(`CP-6A · Chair weighting — "${w.claim}"`);
  });
  Object.entries(MODULE_OUTPUTS).forEach(([mid, out]) => {
    out.sections.forEach((s) => {
      if ("ev" in s && s.ev && s.ev.includes(id)) hits.push(`${mid} · ${s.title}`);
      if (s.type === "flags") s.items.forEach((f) => { if (f.ev && f.ev.includes(id)) hits.push(`${mid} · ${s.title}`); });
    });
  });
  reports.forEach((rep) => {
    rep.srcs.forEach((s) => {
      if (s.ev.includes(id)) hits.push(`${rep.title} · ${s.chip}`);
    });
  });
  return hits;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "var(--caos-border)" }}>
      <div className="h-full rounded-full" style={{ width: Math.max(0, Math.min(100, pct)) + "%", background: color }} />
    </div>
  );
}

function StatusBadge({ status, label }: { status: "verified" | "open"; label?: string }) {
  return (
    <span
      className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
      style={{
        color: status === "open" ? "var(--caos-warning)" : "var(--caos-success)",
        borderColor: status === "open" ? "color-mix(in srgb, var(--caos-warning) 40%, transparent)" : "color-mix(in srgb, var(--caos-success) 40%, transparent)",
        background: status === "open" ? "color-mix(in srgb, var(--caos-warning) 8%, transparent)" : "color-mix(in srgb, var(--caos-success) 8%, transparent)",
      }}
    >
      {label ?? (status === "open" ? "UNRESOLVED" : "VERIFIED")}
    </span>
  );
}

function Row({ k, v, accent, title }: { k: string; v: string; accent?: boolean; title?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-caos-muted whitespace-nowrap">{k}</span>
      <span className={"tabular text-right break-words" + (accent ? " text-caos-accent" : "")} title={title}>{v}</span>
    </div>
  );
}

// Shared dialog shell for the live / unresolved panels (narrower than the rich
// seeded viewer, which keeps its own layout below).
function EvShell({
  id, status, panelRef, onClose, children,
}: {
  id: string;
  status: ReactNode;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalBackdrop onClose={onClose} padded>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={"Source evidence " + id}
        className="bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain w-full max-w-[760px]"
        style={{ maxHeight: "86vh", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60">
          <span className="tabular text-caos-2xl text-caos-text whitespace-nowrap">{id}</span>
          {status}
          <div className="flex-1" />
          <CloseButton onClick={onClose} size="md" className="ml-2" />
        </div>
        {children}
      </div>
    </ModalBackdrop>
  );
}

// Live click-to-source: resolve a run's own evidence to its real source chunk,
// instead of the seeded demo map (which 404s for live ids).
function LiveEvidencePanel({
  id, ev, text, error, panelRef, onClose,
}: {
  id: string;
  ev: LiveEvidence;
  text: string | null;
  error: boolean;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const status = liveStatus(ev.lineage_class);
  return (
    <EvShell id={id} status={<StatusBadge status={status} />} panelRef={panelRef} onClose={onClose}>
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-4 py-3 border-b border-caos-border bg-caos-bg">
          <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Source extract</div>
          {ev.document_chunk_id ? (
            text != null ? (
              <p className="text-caos-lg leading-[1.7] text-caos-text whitespace-pre-wrap">{text}</p>
            ) : error ? (
              <div role="alert" className="text-caos-md" style={{ color: "var(--caos-warning)" }}>
                Source unavailable — the linked chunk could not be loaded. Retry, or reopen once the run finishes.
              </div>
            ) : (
              <div className="text-caos-md text-caos-muted">Loading source…</div>
            )
          ) : (
            <div className="text-caos-md text-caos-muted">No source chunk is linked to this citation — lineage is unresolved.</div>
          )}
        </div>
        <div className="px-4 py-3 text-caos-md text-caos-text leading-relaxed grid gap-1.5">
          <Row k="Cited claim" v={ev.claim} />
          <Row k="Extracted by" v={ev.module} accent />
          <Row k="Locator" v={ev.source_locator || "—"} />
          <Row k="Lineage class" v={ev.lineage_class} />
          <Row k="Confidence" v={ev.confidence} />
          <Row k="Trace status" v={status === "open" ? "lineage flagged" : "CP-5B verified"} />
          {/* Short source ref, not a raw 36-char UUID dump on an analyst
              surface; full id stays on hover for lineage debugging. (critique) */}
          <Row k="Source ref" v={ev.document_chunk_id ? ev.document_chunk_id.slice(0, 8) : "—"} title={ev.document_chunk_id || undefined} />
        </div>
      </div>
    </EvShell>
  );
}

function UnresolvedEvidencePanel({
  id, panelRef, onClose,
}: {
  id: string;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  return (
    <EvShell id={id} status={<StatusBadge status="open" />} panelRef={panelRef} onClose={onClose}>
      <div className="px-5 py-6 text-caos-md text-caos-text leading-relaxed">
        <p className="mb-2">This citation could not be resolved to a source for the current run.</p>
        <p className="text-caos-muted">
          Evidence id <span className="tabular text-caos-text">{id}</span> is not in this run&apos;s evidence
          set nor the seeded reference deal — it may belong to a module that did not run, or a superseded run.
        </p>
      </div>
    </EvShell>
  );
}

type SeededEvidence = (typeof EVIDENCE)[string];
type SeededDocument = (typeof DOCS)[number];

function SeededEvidenceHeader({ id, evidence, confidenceColor, onClose }: { id: string; evidence: SeededEvidence; confidenceColor: string; onClose: () => void }) {
  return (
    <div className="h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60">
      <span className="tabular text-caos-2xl text-caos-text whitespace-nowrap">{id}</span>
      <StatusBadge status={evidence.status} />
      <span className="text-caos-xl text-caos-muted truncate">{evidence.section}</span>
      <div className="flex-1" />
      <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">confidence</span>
      <div className="w-20"><Bar pct={evidence.conf * 100} color={confidenceColor} /></div>
      <span className="tabular text-caos-md" style={{ color: confidenceColor }}>{(evidence.conf * 100).toFixed(0)}%</span>
      <CloseButton onClick={onClose} size="md" className="ml-2" />
    </div>
  );
}

function SeededSourceExtract({ evidence, document, documentName }: { evidence: SeededEvidence; document: SeededDocument | undefined; documentName: string }) {
  return (
    <div className="min-h-0 overflow-auto border-r border-caos-border bg-caos-bg">
      <div className="sticky top-0 px-4 py-2 border-b border-caos-border bg-caos-bg flex items-center gap-2">
        <span className="text-caos-lg text-caos-text whitespace-nowrap">{documentName}</span>
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap">{evidence.doc}{evidence.page ? ` · p.${evidence.page}` : ""}</span>
        <div className="flex-1" /><span className="tabular text-caos-xs text-caos-muted uppercase tracking-wider whitespace-nowrap">source extract</span>
      </div>
      <div className="px-6 py-5 max-w-[640px]">
        <div className="tabular text-caos-sm uppercase tracking-widest text-caos-muted mb-3">{evidence.section}</div>
        {evidence.excerpt.map((passage, index) => <p key={index} className={`text-caos-xl leading-[1.75] mb-3 ${passage.hit ? "clause-highlight px-2.5 py-2 text-caos-text" : "text-caos-text/70"}`}>{passage.t}</p>)}
        <div className="tabular text-caos-2xs text-caos-muted mt-4 pt-2 border-t border-caos-border flex justify-between whitespace-nowrap">
          <span>{documentName}</span>{evidence.page ? <span>page {evidence.page} of {document?.pages ?? "—"}</span> : <span>live feed</span>}
        </div>
      </div>
    </div>
  );
}

function DocumentMetadata({ evidence, document }: { evidence: SeededEvidence; document: SeededDocument | undefined }) {
  if (!document) return <div className="text-caos-md text-caos-muted">External market data — LoanX marks + dealer runs, Jun 8 2026.</div>;
  const gradeColor = document.grade === "A" ? "var(--caos-success)" : document.grade === "B" ? "var(--caos-warning)" : "var(--caos-critical)";
  return (
    <div className="text-caos-md text-caos-text leading-relaxed">
      <Row k="Document" v={evidence.doc} /><Row k="Type" v={document.type} />
      <div className="flex justify-between gap-2"><span className="text-caos-muted">Quality grade</span><span className="tabular whitespace-nowrap" style={{ color: gradeColor }}>{document.grade}</span></div>
      <Row k="Dated" v={document.date} />
      {document.mnpi ? <div className="flex justify-between gap-2"><span className="text-caos-muted">Handling</span><span className="tabular whitespace-nowrap" style={{ color: "var(--caos-warning)" }}>MNPI</span></div> : null}
    </div>
  );
}

function ExtractionMetadata({ evidence }: { evidence: SeededEvidence }) {
  const flagged = evidence.status === "open";
  return (
    <div className="text-caos-md text-caos-text leading-relaxed">
      <Row k="Extracted by" v={evidence.module} accent />
      <Row k="Anchor" v={evidence.page ? `p.${evidence.page} · quote` : "feed snapshot"} />
      <div className="flex justify-between gap-2"><span className="text-caos-muted">Trace status</span><span className="tabular whitespace-nowrap" style={{ color: flagged ? "var(--caos-warning)" : "var(--caos-success)" }}>{flagged ? "lineage flagged" : "CP-5B verified"}</span></div>
    </div>
  );
}

function CitationList({ citations }: { citations: string[] }) {
  if (!citations.length) return <div className="text-caos-sm text-caos-muted">No registered citations.</div>;
  return <>{citations.map((citation, index) => <div key={index} className="text-caos-sm text-caos-text/85 leading-relaxed flex gap-1.5"><span className="text-caos-accent">▸</span>{citation}</div>)}</>;
}

function SeededMetadataRail({ id, evidence, document, citations }: { id: string; evidence: SeededEvidence; document: SeededDocument | undefined; citations: string[] }) {
  return (
    <div className="min-h-0 overflow-auto">
      {evidence.qa ? <div className="px-3 py-2.5 border-b border-caos-border" style={{ background: "color-mix(in srgb, var(--caos-warning) 6%, transparent)" }}><div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-warning)" }}>QA finding</div><div className="text-caos-md text-caos-text leading-snug">{evidence.qa}</div></div> : null}
      <div className="px-3 py-2.5 border-b border-caos-border"><div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Source</div><DocumentMetadata evidence={evidence} document={document} /></div>
      <div className="px-3 py-2.5 border-b border-caos-border"><div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Extraction</div><ExtractionMetadata evidence={evidence} /></div>
      <div className="px-3 py-2.5 border-b border-caos-border"><div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Cited by · {citations.length}</div><CitationList citations={citations} /></div>
      <div className="px-3 py-2.5 flex flex-col gap-1.5"><FlagToQa issuerId={ATLF_REFERENCE_ISSUER_ID} moduleId={evidence.module} stepRef={`evidence ${id}`} /></div>
    </div>
  );
}

function SeededEvidencePanel({ id, evidence, reports, panelRef, onClose }: { id: string; evidence: SeededEvidence; reports: Report[]; panelRef: RefObject<HTMLDivElement>; onClose: () => void }) {
  const document = DOCS.find((candidate) => candidate.id === evidence.doc);
  const documentName = document?.name ?? "Market Data Feed (LoanX / desk)";
  const confidenceColor = evidence.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)";
  const citations = findCitations(id, reports);
  return (
    <ModalBackdrop onClose={onClose} padded>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Source evidence ${id}`} className="bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain w-full max-w-[1150px]" style={{ maxHeight: "86vh", boxShadow: "var(--shadow-modal)" }} onClick={(event) => event.stopPropagation()}>
        <SeededEvidenceHeader id={id} evidence={evidence} confidenceColor={confidenceColor} onClose={onClose} />
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_300px]">
          <SeededSourceExtract evidence={evidence} document={document} documentName={documentName} />
          <SeededMetadataRail id={id} evidence={evidence} document={document} citations={citations} />
        </div>
      </div>
    </ModalBackdrop>
  );
}

export function EvidenceModal({
  id,
  reports,
  live,
  isLiveRun = false,
  onClose,
}: {
  id: string;
  reports: Report[];
  // The current run's own evidence index (deep-dive live path). When an id is
  // present here it is preferred over the seeded EVIDENCE map, so a live chip
  // resolves to the run's real source and never shadow-resolves to a demo key.
  live?: Record<string, LiveEvidence>;
  // True when the open run is a LIVE non-reference run (not the seeded ATLF
  // showcase). In that case an id absent from the live evidence map must NOT
  // shadow-resolve to the seeded EVIDENCE excerpt — that excerpt belongs to the
  // ATLF reference deal and would render ANOTHER issuer's source as "VERIFIED".
  // Show the explicit unresolved state instead.
  isLiveRun?: boolean;
  onClose: () => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const liveEv = live?.[id];
  // Prefer the run's own evidence. Fall back to the seeded demo map ONLY for the
  // reference deal; for a live run a missing id is unresolved, never the seeded
  // ATLF excerpt (cross-issuer "verified" leak).
  // Parenthesized on purpose: when liveEv exists the early return below renders it;
  // `ev` only matters for the seeded-vs-unresolved split on non-live lookups.
  const ev = (liveEv || isLiveRun) ? undefined : EVIDENCE[id];
  const [chunkText, setChunkText] = useState<string | null>(null);
  const [chunkErr, setChunkErr] = useState(false);
  const chunkId = liveEv?.document_chunk_id ?? null;
  useEffect(() => {
    if (!chunkId) return;
    let alive = true;
    setChunkText(null);
    setChunkErr(false);
    // On failure surface an explicit unavailable state — the render had no error
    // branch, so a 404 / failed chunk fetch spun "Loading source…" forever. SEAM3-3.
    getChunk(chunkId).then((c) => { if (alive) setChunkText(c.text); }).catch(() => { if (alive) setChunkErr(true); });
    return () => { alive = false; };
  }, [chunkId]);

  if (liveEv) return <LiveEvidencePanel id={id} ev={liveEv} text={chunkText} error={chunkErr} panelRef={panelRef} onClose={onClose} />;
  // Unknown id (neither live nor seeded): an explicit state, never a silent no-op.
  if (!ev) return <UnresolvedEvidencePanel id={id} panelRef={panelRef} onClose={onClose} />;
  return <SeededEvidencePanel id={id} evidence={ev} reports={reports} panelRef={panelRef} onClose={onClose} />;
}
