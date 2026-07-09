"use client";

// Required-output register (workflow completeness per module ACTIVE_PROMPT)
// + step-output viewer modal showing each step's full analytical output per
// the Modular OS REF templates (port of design bundle concept-c-views.jsx).

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloseButton } from "@/components/shared/CloseButton";
import { FlagToQa } from "@/components/shared/FlagToQa";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { MODULE_STEPS, STEP_STATUS_TEXT, type StepRow } from "@/lib/deepdive/module-steps";
import { STEP_NOTES } from "@/lib/deepdive/step-notes";
import { STEP_OUTPUTS } from "@/lib/deepdive/step-outputs";
import { MODULES } from "@/lib/pipeline/data";
import { SEV_COLOR } from "@/lib/pipeline/sev";
import { EvChip } from "@/components/reports/EvidenceModal";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { OutSections } from "./OutSections";
import type { OutSection } from "@/lib/deepdive/module-outputs";

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
        onClick={toggleOpen}
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
        <div className="grid grid-cols-2 gap-x-5 px-3 py-1.5 border-t border-caos-border">
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
   behind a modal. Summary/report cap at 4 columns and consolidate repeated
   same-prefix/status cards; summary keeps only the narrative step summary.
   Dense keeps every card unconsolidated. */
export function StepOutputGrid({ id, onOpenEvidence, mode = "dense" }: { id: string; onOpenEvidence: (id: string) => void; mode?: "summary" | "report" | "dense" }) {
  const steps = MODULE_STEPS[id];
  if (!steps) return null;
  const cards = steps
    .map((s) => ({ s, data: STEP_OUTPUTS[id + ":" + s[1]], narr: STEP_NOTES[id + ":" + s[1]] }))
    .filter((c) => c.data || c.narr);
  if (!cards.length) return null;
  const isSummary = mode === "summary";
  // column-width is a minimum; multicol stretches the columns to fill the pane.
  // report also sets column-count to cap at 4 even on an ultrawide display.
  const containerStyle: React.CSSProperties = mode !== "dense"
    ? { columns: "280px 4", columnGap: 8 }
    : { columns: "360px", columnGap: 8 };
  const cardCls = "rounded border border-caos-border bg-caos-panel/40 p-2 flex flex-col gap-2 overflow-x-auto min-w-0 break-inside-avoid mb-2";
  const visibleCards = mode !== "dense" ? reportCards(cards) : cards.map((card) => ({ kind: "single" as const, card }));
  return (
    <div className="flex flex-col gap-2">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted px-0.5">
        {isSummary
          ? `${id} workflow step summary · ${cards.length} of ${steps.length} steps with notes`
          : `${id} workflow step outputs · detailed output for ${cards.length} of ${steps.length} steps`}
      </div>
      <div style={containerStyle}>
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
              {data && !isSummary ? <OutSections sections={data.sections} onOpenEvidence={onOpenEvidence} /> : null}
            </div>
          );
        })}
      </div>
    </div>
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

  const evs: string[] = [];
  const addEv = (a?: string[]) => a && a.forEach((e) => { if (!evs.includes(e)) evs.push(e); });
  if (data) data.sections.forEach((s: OutSection) => {
    if ("ev" in s) addEv(s.ev);
    if (s.type === "flags") s.items.forEach((f) => addEv(f.ev));
  });
  if (narr) addEv(narr.ev);
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
        <div className="h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60">
          <span className="tabular text-caos-2xl text-caos-text whitespace-nowrap">{id}{code !== "—" ? " · " + code : ""}</span>
          <span className="text-caos-2xl font-semibold text-caos-text whitespace-nowrap">{name}</span>
          <Tag sev={sevKey}>{STEP_STATUS_TEXT[status] || status}</Tag>
          <span className="text-caos-md text-caos-muted truncate">{meta?.name}</span>
          <div className="flex-1"></div>
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap" title="Seeded ATLF reference register — not a database run">ATLF · SEEDED RUN #2641</span>
          <CloseButton onClick={onClose} size="md" className="ml-2" />
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_272px]">
          <div className="min-h-0 overflow-auto border-r border-caos-border bg-caos-bg p-3 flex flex-col gap-3">
            {narr ? (
              <div className="rounded border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--tranche-2l) 35%, transparent)", background: "color-mix(in srgb, var(--tranche-2l) 6%, transparent)" }}>
                <div className="tabular text-caos-xs uppercase tracking-wider text-caos-accent mb-1">Analyst narrative</div>
                <div className="text-caos-xl text-caos-text leading-relaxed">
                  {narr.body}
                  {narr.ev && narr.ev.length ? (
                    <span className="inline-flex gap-1 ml-1.5 align-middle">
                      {narr.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {data ? <OutSections sections={data.sections} onOpenEvidence={onOpenEvidence} /> : (
              <div className="rounded border border-caos-border bg-caos-bg px-3 py-2.5 text-caos-lg text-caos-muted leading-relaxed">
                {stepNote ? `${name} — ${stepNote}. Registered to the ${id} output set.` : `${name} registered to the ${id} output set; no findings attached.`}
              </div>
            )}
          </div>
          <div className="min-h-0 overflow-auto">
            <div className="px-3 py-2.5 border-b border-caos-border">
              <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Template</div>
              <div className="text-caos-md text-caos-text leading-relaxed">
                <div className="flex justify-between gap-2"><span className="text-caos-muted">REF file</span><span className="tabular whitespace-nowrap text-caos-accent">{data?.ref || "REF_" + id}</span></div>
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Required output</span><span className="tabular text-right">{data?.out || name}</span></div>
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Workflow step</span><span className="tabular whitespace-nowrap">{code !== "—" ? code : "unnumbered"}</span></div>
              </div>
            </div>
            <div className="px-3 py-2.5 border-b border-caos-border">
              <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Production</div>
              <div className="text-caos-md text-caos-text leading-relaxed">
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Module</span><span className="tabular whitespace-nowrap text-caos-accent">{id}</span></div>
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Status</span><span className="tabular whitespace-nowrap" style={{ color: SEV_COLOR[sevKey] }}>{(STEP_STATUS_TEXT[status] || status).toUpperCase()}</span></div>
                {stepNote ? <div className="flex justify-between gap-2"><span className="text-caos-muted shrink-0">Note</span><span className="tabular text-right">{stepNote}</span></div> : null}
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Run</span><span className="tabular whitespace-nowrap">#2641 · Jun 10 · seeded</span></div>
              </div>
            </div>
            <div className="px-3 py-2.5 border-b border-caos-border">
              <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Evidence cited · {evs.length}</div>
              {evs.length ? (
                <div className="flex flex-wrap gap-1">{evs.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}</div>
              ) : (
                <div className="text-caos-sm text-caos-muted">No registered citations — synthesis or process output.</div>
              )}
            </div>
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
              <Link
                href={`/reports?report=${EXPORT_REPORT[id] || "snapshot"}`}
                className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring text-center"
                title={`Open the ${id} output in its Report Studio exhibit`}
              >
                OPEN IN MODULE EXPORT
              </Link>
              <FlagToQa moduleId={id} stepRef={(code !== "—" ? code + " " : "") + name} />
            </div>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}
