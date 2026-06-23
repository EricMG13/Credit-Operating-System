"use client";

// E-xx evidence source viewer (port of design bundle concept-c-views.jsx).
// Shows the exact cited source extract with the passage highlighted, document
// metadata, extraction anchor, CP-5B trace status, and cited-by trail.

import { useModalA11y } from "@/lib/use-modal-a11y";
import { CloseButton } from "@/components/shared/CloseButton";
import { EVIDENCE } from "@/lib/reports/evidence";
import { DOCS, DEBATE } from "@/lib/reports/deal";
import { MODULE_OUTPUTS } from "@/lib/deepdive/module-outputs";
import type { Report } from "@/lib/reports/builders";
import { useEvidenceSync } from "@/lib/evidence-sync";
import { StatusGlyph } from "@/components/shared/StatusGlyph";

export function EvChip({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const open = (EVIDENCE[id] || {}).status === "open";
  // Publish this id on hover/focus and highlight when it (or any other chip
  // citing the same id, or its source driver) is the active selection.
  const { active, setActive } = useEvidenceSync();
  const synced = active === id;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(id); }}
      onMouseEnter={() => setActive(id)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(id)}
      onBlur={() => setActive(null)}
      title={"Open source for " + id}
      aria-label={"Open source for " + id}
      className="tabular text-caos-xs px-1 py-px rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated focus-ring"
      style={{
        color: open ? "var(--caos-warning)" : "var(--caos-accent)",
        borderColor: synced ? "var(--caos-accent)" : open ? "rgba(245,165,36,0.5)" : "rgba(79,140,255,0.4)",
        background: synced ? "rgba(79,140,255,0.18)" : "rgba(79,140,255,0.07)",
        boxShadow: synced ? "0 0 0 1px var(--caos-accent)" : undefined,
      }}
    >
      {id}{open ? <StatusGlyph kind="warning" className="ml-0.5" /> : null}
    </button>
  );
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

export function EvidenceModal({
  id,
  reports,
  onClose,
}: {
  id: string;
  reports: Report[];
  onClose: () => void;
}) {
  const ev = EVIDENCE[id];
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  if (!ev) return null;
  const doc = DOCS.find((d) => d.id === ev.doc);
  const docName = doc ? doc.name : "Market Data Feed (LoanX / desk)";
  const cites = findCitations(id, reports);
  const confColor = ev.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)";
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-6" style={{ background: "rgba(5,5,7,0.72)" }} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={"Source evidence " + id}
        className="bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain w-full max-w-[1150px]"
        style={{ maxHeight: "86vh", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60">
          <span className="tabular text-caos-2xl text-caos-text whitespace-nowrap">{id}</span>
          <span
            className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
            style={{
              color: ev.status === "open" ? "var(--caos-warning)" : "var(--caos-success)",
              borderColor: ev.status === "open" ? "rgba(245,165,36,0.4)" : "rgba(34,197,94,0.4)",
              background: ev.status === "open" ? "rgba(245,165,36,0.08)" : "rgba(34,197,94,0.08)",
            }}
          >
            {ev.status === "open" ? "UNRESOLVED" : "VERIFIED"}
          </span>
          <span className="text-caos-xl text-caos-muted truncate">{ev.section}</span>
          <div className="flex-1" />
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">confidence</span>
          <div className="w-20"><Bar pct={ev.conf * 100} color={confColor} /></div>
          <span className="tabular text-caos-md" style={{ color: confColor }}>{(ev.conf * 100).toFixed(0)}%</span>
          <CloseButton onClick={onClose} size="md" className="ml-2" />
        </div>
        {/* body */}
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_300px]">
          {/* source extract */}
          <div className="min-h-0 overflow-auto border-r border-caos-border bg-caos-bg">
            <div className="sticky top-0 px-4 py-2 border-b border-caos-border bg-caos-bg flex items-center gap-2">
              <span className="text-caos-lg text-caos-text whitespace-nowrap">{docName}</span>
              <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap">
                {ev.doc}{ev.page ? ` · p.${ev.page}` : ""}
              </span>
              <div className="flex-1" />
              <span className="tabular text-caos-xs text-caos-muted uppercase tracking-wider whitespace-nowrap">source extract</span>
            </div>
            <div className="px-6 py-5 max-w-[640px]">
              <div className="tabular text-caos-sm uppercase tracking-widest text-caos-muted mb-3">{ev.section}</div>
              {ev.excerpt.map((p, i) => (
                <p key={i} className={"text-caos-xl leading-[1.75] mb-3 " + (p.hit ? "clause-highlight px-2.5 py-2 text-caos-text" : "text-caos-text/70")}>
                  {p.t}
                </p>
              ))}
              <div className="tabular text-caos-2xs text-caos-muted mt-4 pt-2 border-t border-caos-border flex justify-between whitespace-nowrap">
                <span>{docName}</span>
                {ev.page ? <span>page {ev.page} of {doc ? doc.pages : "—"}</span> : <span>live feed</span>}
              </div>
            </div>
          </div>
          {/* metadata rail */}
          <div className="min-h-0 overflow-auto">
            {ev.qa ? (
              <div className="px-3 py-2.5 border-b border-caos-border" style={{ background: "rgba(245,165,36,0.06)" }}>
                <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-warning)" }}>QA finding</div>
                <div className="text-caos-md text-caos-text leading-snug">{ev.qa}</div>
              </div>
            ) : null}
            <div className="px-3 py-2.5 border-b border-caos-border">
              <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Source</div>
              {doc ? (
                <div className="text-caos-md text-caos-text leading-relaxed">
                  <div className="flex justify-between gap-2"><span className="text-caos-muted">Document</span><span className="tabular whitespace-nowrap">{ev.doc}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-caos-muted">Type</span><span className="tabular whitespace-nowrap">{doc.type}</span></div>
                  <div className="flex justify-between gap-2">
                    <span className="text-caos-muted">Quality grade</span>
                    <span className="tabular whitespace-nowrap" style={{ color: doc.grade === "A" ? "var(--caos-success)" : doc.grade === "B" ? "var(--caos-warning)" : "var(--caos-critical)" }}>{doc.grade}</span>
                  </div>
                  <div className="flex justify-between gap-2"><span className="text-caos-muted">Dated</span><span className="tabular whitespace-nowrap">{doc.date}</span></div>
                  {doc.mnpi ? (
                    <div className="flex justify-between gap-2"><span className="text-caos-muted">Handling</span><span className="tabular whitespace-nowrap" style={{ color: "var(--caos-warning)" }}>MNPI</span></div>
                  ) : null}
                </div>
              ) : (
                <div className="text-caos-md text-caos-muted">External market data — LoanX marks + dealer runs, Jun 8 2026.</div>
              )}
            </div>
            <div className="px-3 py-2.5 border-b border-caos-border">
              <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Extraction</div>
              <div className="text-caos-md text-caos-text leading-relaxed">
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Extracted by</span><span className="tabular text-caos-accent whitespace-nowrap">{ev.module}</span></div>
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Anchor</span><span className="tabular whitespace-nowrap">{ev.page ? `p.${ev.page} · quote` : "feed snapshot"}</span></div>
                <div className="flex justify-between gap-2">
                  <span className="text-caos-muted">Trace status</span>
                  <span className="tabular whitespace-nowrap" style={{ color: ev.status === "open" ? "var(--caos-warning)" : "var(--caos-success)" }}>
                    {ev.status === "open" ? "lineage flagged" : "CP-5B verified"}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-3 py-2.5 border-b border-caos-border">
              <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Cited by · {cites.length}</div>
              {cites.map((c, i) => (
                <div key={i} className="text-caos-sm text-caos-text/85 leading-relaxed flex gap-1.5"><span className="text-caos-accent">▸</span>{c}</div>
              ))}
              {!cites.length ? <div className="text-caos-sm text-caos-muted">No registered citations.</div> : null}
            </div>
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
              <button className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
                OPEN IN SOURCE VAULT
              </button>
              <button className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos">
                FLAG TO QA · CP-5
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
