"use client";

// Required-output register (workflow completeness per module ACTIVE_PROMPT)
// + step-output viewer modal showing each step's full analytical output per
// the Modular OS REF templates (port of design bundle concept-c-views.jsx).

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloseButton } from "@/components/shared/CloseButton";
import { FlagToQa } from "@/components/shared/FlagToQa";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { MODULE_STEPS, STEP_STATUS_TEXT, type StepRow } from "@/lib/deepdive/module-steps";
import { STEP_NOTES } from "@/lib/deepdive/step-notes";
import { STEP_OUTPUTS } from "@/lib/deepdive/step-outputs";
import { MODULES } from "@/lib/pipeline/data";
import { SEV_COLOR } from "@/lib/pipeline/sev";
import { EvChip } from "@/components/reports/EvChip";
import { EvidenceSelectionList, type EvidenceSelectionItem } from "@/components/shared/EvidenceSelectionList";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { OutSections } from "./OutSections";
import type { ModuleOutput, OutSection } from "@/lib/deepdive/module-outputs";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";

export function LiveOutputRegister({
  id,
  output,
  onOpenEvidence,
  defaultOpen = true,
}: {
  id: string;
  output: ModuleOutput;
  onOpenEvidence: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded border border-caos-accent/45 bg-caos-bg" aria-label={`${id} live runtime output register`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`${id}-live-runtime-outputs`}
        className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-caos-elevated/40 transition-caos focus-ring"
      >
        <span className="tabular text-caos-xs uppercase tracking-wider text-caos-accent whitespace-nowrap">
          {id} runtime output register · {output.sections.length} emitted section{output.sections.length === 1 ? "" : "s"}
        </span>
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
          Live · persisted engine output
        </span>
        <span className="flex-1" />
        <span className="text-caos-muted text-caos-xs" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div id={`${id}-live-runtime-outputs`} className="border-t border-caos-border p-3 flex flex-col gap-3">
          {output.sections.length ? (
            <OutSections sections={output.sections} onOpenEvidence={onOpenEvidence} />
          ) : (
            <div role="note" className="text-caos-md text-caos-muted leading-snug">
              The engine emitted headline fields only; no structured runtime sections were persisted.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function OutputRegister({
  id,
  defaultOpen = true,
  onOpenEvidence,
}: {
  id: string;
  defaultOpen?: boolean;
  onOpenEvidence: (id: string) => void;
}) {
  const steps = MODULE_STEPS[id];
  const storageKey = "caos-deepdive-output-open:" + id;
  const [open, setOpen] = useState(defaultOpen);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setOpen(saved == null ? defaultOpen : saved === "1");
    } catch {
      setOpen(defaultOpen);
    }
  }, [defaultOpen, storageKey]);
  const toggleOpen = () => {
    const next = !open;
    if (open) setSel(null);
    setOpen(next);
    try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
  };
  if (!steps) return null;
  const n = (s: string) => steps.filter((x) => x[2] === s).length;
  const selStep = sel != null ? steps[sel] : null;
  return (
    <div className="rounded border border-caos-border bg-caos-bg">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={`${id}-required-outputs`}
        className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-caos-elevated/40 transition-caos"
      >
        <span className="tabular text-caos-xs uppercase tracking-wider text-caos-muted whitespace-nowrap">
          {id} required outputs · {steps.length} workflow steps
        </span>
        <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-success)" }}>{n("ok")} produced</span>
        {n("warning") ? <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-warning)" }}>{n("warning")} w/ limitation</span> : null}
        {n("gap") ? <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-critical-bright)" }}>{n("gap")} gap logged</span> : null}
        <span className="flex-1"></span>
        {open ? <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">click a step to open its full output</span> : null}
        <span className="text-caos-muted text-caos-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div id={`${id}-required-outputs`} className="grid grid-cols-1 gap-x-5 px-3 py-1.5 border-t border-caos-border xl:grid-cols-2">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setSel(sel === i ? null : i)}
              title={"View analytical output — " + s[1]}
              className={"group flex items-start gap-2 py-[3px] border-b border-caos-border/30 text-left transition-caos rounded-sm " + (sel === i ? "bg-caos-elevated/70" : "hover:bg-caos-elevated/40")}
            >
              <span className="mt-[3px] ml-1"><Dot sev={s[2] === "gap" ? "critical" : (s[2] as string)} /></span>
              <span className="tabular text-caos-2xs text-caos-muted w-[42px] shrink-0 mt-[1.5px] whitespace-nowrap">{s[0]}</span>
              <span className="text-caos-md leading-snug flex-1 text-caos-text">
                {s[1]}
                {s[3] ? <span className="text-caos-muted"> — {s[3]}</span> : null}
              </span>
              <span className={"mt-[2px] mr-1 shrink-0 transition-caos text-caos-xs " + (sel === i ? "text-caos-accent" : "text-caos-muted opacity-0 group-hover:opacity-100")}>⤢</span>
            </button>
          ))}
        </div>
      ) : null}
      {selStep ? <StepOutputModal id={id} step={selStep} onClose={() => setSel(null)} onOpenEvidence={onOpenEvidence} /> : null}
    </div>
  );
}

type StepCard = {
  s: StepRow;
  data: (typeof STEP_OUTPUTS)[string] | undefined;
  narr: (typeof STEP_NOTES)[string] | undefined;
};
type RenderCard =
  | { kind: "single"; card: StepCard }
  | { kind: "group"; key: string; title: string; sev: string; cards: StepCard[] };

function stepSev(s: StepRow): string {
  return s[2] === "gap" ? "critical" : (s[2] || "ok");
}

function cardPrefix(c: StepCard): string {
  const title = c.data?.sections[0]?.title || c.s[1] || "Untitled step";
  return title.split("·")[0].trim() || title;
}

function reportCards(cards: StepCard[]): RenderCard[] {
  const groups = new Map<string, StepCard[]>();
  cards.forEach((card) => {
    const key = stepSev(card.s) + ":" + cardPrefix(card);
    groups.set(key, [...(groups.get(key) || []), card]);
  });
  const out: RenderCard[] = [];
  groups.forEach((group, key) => {
    if (group.length >= 3) {
      out.push({ kind: "group", key, title: cardPrefix(group[0]), sev: stepSev(group[0].s), cards: group });
    } else {
      group.forEach((card) => out.push({ kind: "single", card }));
    }
  });
  return out;
}

/* ---------- inline workflow-step outputs ----------
   Surfaces the per-step analytical output that the register otherwise gates
   behind a modal. Summary preserves workflow order in one compact sequence;
   report consolidates repeated same-prefix/status cards into a responsive
   grid; dense keeps every card unconsolidated in an auto-fit grid. */
export function StepOutputGrid({ id, onOpenEvidence, mode = "dense" }: { id: string; onOpenEvidence: (id: string) => void; mode?: "summary" | "report" | "dense" }) {
  const steps = MODULE_STEPS[id];
  if (!steps) return null;
  const cards = steps
    .map((s) => ({ s, data: STEP_OUTPUTS[id + ":" + s[1]], narr: STEP_NOTES[id + ":" + s[1]] }))
    .filter((c) => c.data || c.narr);
  if (!cards.length) return null;
  const isSummary = mode === "summary";
  const cardCls = "deepdive-step-card rounded border border-caos-border bg-caos-panel/40 p-2 flex min-w-0 flex-col gap-2";
  const visibleCards = mode === "report" ? reportCards(cards) : cards.map((card) => ({ kind: "single" as const, card }));
  return (
    <section className="deepdive-step-grid flex flex-col gap-2" data-mode={mode} aria-label={`${id} workflow steps`}>
      <div className="tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text px-0.5">
        {isSummary
          ? `${id} workflow step summary · ${cards.length} of ${steps.length} steps with notes`
          : `${id} workflow step outputs · detailed output for ${cards.length} of ${steps.length} steps`}
      </div>
      {isSummary ? (
        <ol className="deepdive-step-sequence" aria-label={`${id} sequential workflow summary`}>
          {cards.map(({ s, narr }, i) => {
            const sev = stepSev(s);
            return (
              <li key={`${s[0]}-${s[1]}`} className="deepdive-step-sequence__item">
                <span className="deepdive-step-sequence__rail" aria-hidden="true"><Dot sev={sev} /></span>
                <span className="tabular text-caos-xs font-semibold text-caos-text">{s[0] !== "—" ? s[0] : String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <div className="text-caos-md font-semibold leading-snug text-caos-text">{s[1]}</div>
                  <div className="mt-0.5 text-caos-md leading-relaxed text-caos-text/90">
                    {narr ? narr.body : "No narrative summary is available for this step."}
                    {narr?.ev && narr.ev.length ? <span className="ml-1.5 inline-flex gap-1 align-middle">{narr.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}</span> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
      <div className="deepdive-step-cards" data-mode={mode}>
        {visibleCards.map((item, i) => {
          if (item.kind === "group") {
            return (
              <div key={item.key} className={cardCls}>
                <div className="flex items-center gap-2 px-0.5">
                  <Dot sev={item.sev} />
                  <span className="text-caos-md font-semibold text-caos-text leading-snug">{item.title}</span>
                  <span className="tabular text-caos-2xs text-caos-muted ml-auto">{item.cards.length} steps consolidated</span>
                </div>
                <div className="text-caos-md text-caos-text/90 leading-relaxed px-0.5 flex flex-col gap-1">
                  {item.cards.map(({ s, narr }, j) => (
                    <div key={j}>
                      <span className="tabular text-caos-2xs text-caos-muted mr-1">{s[0] !== "—" ? s[0] : String(j + 1).padStart(2, "0")}</span>
                      {narr ? narr.body : s[1]}
                      {narr?.ev && narr.ev.length ? <span className="inline-flex gap-1 ml-1.5 align-middle">{narr.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          const { s, data, narr } = item.card;
          const sev = stepSev(s);
          return (
            <div key={i} className={cardCls}>
              <div className="flex items-center gap-2 px-0.5">
                <Dot sev={sev} />
                {s[0] !== "—" ? <span className="tabular text-caos-2xs text-caos-muted shrink-0">{s[0]}</span> : null}
                <span className="text-caos-md font-semibold text-caos-text leading-snug">{s[1]}</span>
              </div>
              {narr ? (
                <div className="text-caos-md text-caos-text/90 leading-relaxed px-0.5">
                  {narr.body}
                  {narr.ev && narr.ev.length ? <span className="inline-flex gap-1 ml-1.5 align-middle">{narr.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}</span> : null}
                </div>
              ) : null}
              {data ? <OutSections sections={data.sections} onOpenEvidence={onOpenEvidence} /> : null}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}

// Report Studio exhibit that carries each module's output; snapshot is the
// catch-all committee tear-sheet.
const EXPORT_REPORT: Record<string, string> = {
  "CP-1B": "earnings",
  "CP-4": "covenant",
  "CP-4C": "covenant",
  "CP-MON": "monitor",
  "CP-6A": "memo",
  "CP-6E": "memo",
};

type StepOutputData = (typeof STEP_OUTPUTS)[string] | undefined;
type StepNarrative = (typeof STEP_NOTES)[string] | undefined;

function collectStepEvidence(data: StepOutputData, narrative: StepNarrative): string[] {
  const evidence = new Set<string>();
  data?.sections.forEach((section: OutSection) => {
    if ("ev" in section) section.ev?.forEach((id) => evidence.add(id));
    if (section.type === "flags") section.items.forEach((flag) => flag.ev?.forEach((id) => evidence.add(id)));
  });
  narrative?.ev?.forEach((id) => evidence.add(id));
  return [...evidence];
}

function StepModalHeader({ id, code, name, status, severity, moduleName, onClose }: {
  id: string; code: string; name: string; status: string; severity: string; moduleName?: string; onClose: () => void;
}) {
  return (
    <div className="h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60">
      <span className="tabular text-caos-2xl text-caos-text whitespace-nowrap">{id}{code !== "—" ? " · " + code : ""}</span>
      <span className="text-caos-2xl font-semibold text-caos-text whitespace-nowrap">{name}</span>
      <Tag sev={severity}>{STEP_STATUS_TEXT[status] || status}</Tag>
      <span className="text-caos-md text-caos-muted truncate">{moduleName}</span>
      <div className="flex-1" />
      <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap" title="Seeded ATLF reference register — not a database run">ATLF · SEEDED RUN #2641</span>
      <CloseButton onClick={onClose} size="md" className="ml-2" />
    </div>
  );
}

function StepNarrativeBlock({ narrative, onOpenEvidence }: { narrative: StepNarrative; onOpenEvidence: (id: string) => void }) {
  if (!narrative) return null;
  return (
    <div className="rounded border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--tranche-2l) 35%, transparent)", background: "color-mix(in srgb, var(--tranche-2l) 6%, transparent)" }}>
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-accent mb-1">Analyst narrative</div>
      <div className="text-caos-xl text-caos-text leading-relaxed">
        {narrative.body}
        {narrative.ev?.length ? <span className="inline-flex gap-1 ml-1.5 align-middle">{narrative.ev.map((evidenceId) => <EvChip key={evidenceId} id={evidenceId} onOpen={onOpenEvidence} />)}</span> : null}
      </div>
    </div>
  );
}

function StepAnalyticalOutput({ id, name, stepNote, data, narrative, onOpenEvidence }: {
  id: string; name: string; stepNote?: string; data: StepOutputData; narrative: StepNarrative; onOpenEvidence: (id: string) => void;
}) {
  const fallback = stepNote ? `${name} — ${stepNote}. Registered to the ${id} output set.` : `${name} registered to the ${id} output set; no findings attached.`;
  return (
    <div className="min-h-0 overflow-auto border-r border-caos-border bg-caos-bg p-3 flex flex-col gap-3">
      <StepNarrativeBlock narrative={narrative} onOpenEvidence={onOpenEvidence} />
      {data ? <OutSections sections={data.sections} onOpenEvidence={onOpenEvidence} /> : <div className="rounded border border-caos-border bg-caos-bg px-3 py-2.5 text-caos-lg text-caos-muted leading-relaxed">{fallback}</div>}
    </div>
  );
}

function MetadataRow({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return <div className="flex justify-between gap-2"><span className="text-caos-muted">{label}</span><span className={`tabular text-right ${accent ? "text-caos-accent" : ""}`}>{value}</span></div>;
}

function TemplateMetadata({ id, code, name, data }: { id: string; code: string; name: string; data: StepOutputData }) {
  return (
    <div className="px-3 py-2.5 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Template</div>
      <div className="text-caos-md text-caos-text leading-relaxed">
        <MetadataRow label="REF file" value={data?.ref || "REF_" + id} accent />
        <MetadataRow label="Required output" value={data?.out || name} />
        <MetadataRow label="Workflow step" value={code !== "—" ? code : "unnumbered"} />
      </div>
    </div>
  );
}

function ProductionMetadata({ id, status, severity, stepNote }: { id: string; status: string; severity: string; stepNote?: string }) {
  return (
    <div className="px-3 py-2.5 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Production</div>
      <div className="text-caos-md text-caos-text leading-relaxed">
        <MetadataRow label="Module" value={id} accent />
        <div className="flex justify-between gap-2"><span className="text-caos-muted">Status</span><span className="tabular whitespace-nowrap" style={{ color: SEV_COLOR[severity] }}>{(STEP_STATUS_TEXT[status] || status).toUpperCase()}</span></div>
        {stepNote ? <MetadataRow label="Note" value={stepNote} /> : null}
        <MetadataRow label="Run" value="#2641 · Jun 10 · seeded" />
      </div>
    </div>
  );
}

function StepEvidenceList({ evidence, onOpenEvidence }: { evidence: string[]; onOpenEvidence: (id: string) => void }) {
  const items: EvidenceSelectionItem[] = evidence.map((id) => ({
    id,
    label: "Registered evidence",
    description: "Cited by this workflow output",
    status: "Cited",
    effect: { kind: "callback", onOpen: onOpenEvidence },
  }));
  return (
    <div className="px-3 py-2.5 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Evidence cited · {evidence.length}</div>
      {evidence.length ? <EvidenceSelectionList label="Evidence cited" items={items} /> : <div className="text-caos-sm text-caos-muted">No registered citations — synthesis or process output.</div>}
    </div>
  );
}

function StepMetadataRail({ id, code, name, status, severity, stepNote, data, evidence, onOpenEvidence }: {
  id: string; code: string; name: string; status: string; severity: string; stepNote?: string; data: StepOutputData; evidence: string[]; onOpenEvidence: (id: string) => void;
}) {
  return (
    <div className="min-h-0 overflow-auto">
      <TemplateMetadata id={id} code={code} name={name} data={data} />
      <ProductionMetadata id={id} status={status} severity={severity} stepNote={stepNote} />
      <StepEvidenceList evidence={evidence} onOpenEvidence={onOpenEvidence} />
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        <Link href={`/reports?report=${EXPORT_REPORT[id] || "snapshot"}`} className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring text-center" title={`Open the ${id} output in its Report Studio exhibit`}>OPEN IN MODULE EXPORT</Link>
        <FlagToQa issuerId={ATLF_REFERENCE_ISSUER_ID} moduleId={id} stepRef={(code !== "—" ? code + " " : "") + name} />
      </div>
    </div>
  );
}

/* ---------- step output viewer (full analytical output per REF template) ---------- */
export function StepOutputModal({
  id,
  step,
  onClose,
  onOpenEvidence,
}: {
  id: string;
  step: StepRow;
  onClose: () => void;
  onOpenEvidence: (id: string) => void;
}) {
  const code = step[0] || "—", name = step[1] || "", status = step[2] || "ok", stepNote = step[3];
  const data = STEP_OUTPUTS[id + ":" + name];
  const narr = STEP_NOTES[id + ":" + name];
  const meta = MODULES.find((m) => m.id === id);
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const evs = collectStepEvidence(data, narr);
  const sevKey = status === "gap" ? "critical" : status;

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Module output register"
        className="caos-enter bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain"
        style={{ width: 1080, maxWidth: "94vw", maxHeight: "min(840px, 92vh)", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <StepModalHeader id={id} code={code} name={name} status={status} severity={sevKey} moduleName={meta?.name} onClose={onClose} />
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_272px]">
          <StepAnalyticalOutput id={id} name={name} stepNote={stepNote} data={data} narrative={narr} onOpenEvidence={onOpenEvidence} />
          <StepMetadataRail id={id} code={code} name={name} status={status} severity={sevKey} stepNote={stepNote} data={data} evidence={evs} onOpenEvidence={onOpenEvidence} />
        </div>
      </div>
    </ModalBackdrop>
  );
}
