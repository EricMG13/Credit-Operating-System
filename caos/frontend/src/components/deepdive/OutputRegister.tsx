"use client";

// Required-output register (workflow completeness per module ACTIVE_PROMPT)
// + step-output viewer modal showing each step's full analytical output per
// the Modular OS REF templates (port of design bundle concept-c-views.jsx).

import { useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { MODULE_STEPS, STEP_STATUS_TEXT, type StepRow } from "@/lib/deepdive/module-steps";
import { STEP_NOTES } from "@/lib/deepdive/step-notes";
import { STEP_OUTPUTS } from "@/lib/deepdive/step-outputs";
import { MODULES } from "@/lib/pipeline/data";
import { SEV_COLOR } from "@/lib/pipeline/sim";
import { EvChip } from "@/components/reports/EvidenceModal";
import { Dot, Tag } from "@/components/pipeline/atoms";
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
  const [open, setOpen] = useState(defaultOpen);
  const [sel, setSel] = useState<number | null>(null);
  if (!steps) return null;
  const n = (s: string) => steps.filter((x) => x[2] === s).length;
  const selStep = sel != null ? steps[sel] : null;
  return (
    <div className="rounded border border-caos-border bg-caos-bg">
      <button
        onClick={() => { if (open) setSel(null); setOpen(!open); }}
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

/* ---------- inline workflow-step outputs ----------
   Surfaces the per-step analytical output that the register otherwise gates
   behind a modal. Both modes pack newspaper-style — cards flow top→bottom and
   pack tight, so empty space only ever appears at the bottom of the last column.
   The only difference is the column count:
     base  — capped at 4 columns (column-count), each stretched to fill; fewer on
             narrow panes.
     dense — as many ~360px columns as the pane fits (maximum density).
   Each card clips its own overflow (overflow-x-auto + min-w-0) so a wide table
   scrolls inside the card instead of spilling across columns. */
export function StepOutputGrid({ id, onOpenEvidence, mode = "dense" }: { id: string; onOpenEvidence: (id: string) => void; mode?: "base" | "dense" }) {
  const steps = MODULE_STEPS[id];
  if (!steps) return null;
  const cards = steps
    .map((s) => ({ s, data: STEP_OUTPUTS[id + ":" + s[1]], narr: STEP_NOTES[id + ":" + s[1]] }))
    .filter((c) => c.data || c.narr);
  if (!cards.length) return null;
  // column-width is a minimum; multicol stretches the columns to fill the pane.
  // base also sets column-count to cap at 4 even on an ultrawide display.
  const containerStyle: React.CSSProperties = mode === "base"
    ? { columns: "280px 4", columnGap: 8 }
    : { columns: "360px", columnGap: 8 };
  const cardCls = "rounded border border-caos-border bg-caos-panel/40 p-2 flex flex-col gap-2 overflow-x-auto min-w-0 break-inside-avoid mb-2";
  return (
    <div className="flex flex-col gap-2">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted px-0.5">
        {id} workflow step outputs · {cards.length} of {steps.length} produced detail
      </div>
      <div style={containerStyle}>
        {cards.map(({ s, data, narr }, i) => {
          const sev = s[2] === "gap" ? "critical" : (s[2] as string);
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

  const evs: string[] = [];
  const addEv = (a?: string[]) => a && a.forEach((e) => { if (!evs.includes(e)) evs.push(e); });
  if (data) data.sections.forEach((s: OutSection) => {
    if ("ev" in s) addEv(s.ev);
    if (s.type === "flags") s.items.forEach((f) => addEv(f.ev));
  });
  if (narr) addEv(narr.ev);
  const sevKey = status === "gap" ? "critical" : status;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center" style={{ background: "rgba(5,5,7,0.72)" }} onClick={onClose}>
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
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">RUN #2641 · ATLF</span>
          <CloseButton onClick={onClose} size="md" className="ml-2" />
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_272px]">
          <div className="min-h-0 overflow-auto border-r border-caos-border bg-caos-bg p-3 flex flex-col gap-3">
            {narr ? (
              <div className="rounded border px-3 py-2.5" style={{ borderColor: "rgba(79,140,255,0.35)", background: "rgba(79,140,255,0.06)" }}>
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
                <div className="flex justify-between gap-2"><span className="text-caos-muted">Run</span><span className="tabular whitespace-nowrap">#2641 · Jun 10</span></div>
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
              <button className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">OPEN IN MODULE EXPORT</button>
              <button className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos">FLAG TO QA · CP-5</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
