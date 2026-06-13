"use client";

// Report Studio rail panels (port of design bundle concept-e.jsx):
// left deliverable queue + right lineage / compose / export rails.

import type { Report, Section } from "@/lib/reports/builders";
import { citeCount, secLabel } from "@/lib/reports/builders";
import { MODULE_NAMES } from "@/lib/reports/deal";
import { EvChip } from "./EvidenceModal";
import { Panel } from "@/components/shared/Panel";

export { Panel };

function StatusTag({ held }: { held: boolean }) {
  const c = held ? "var(--caos-warning)" : "var(--caos-success)";
  return (
    <span
      className="tabular text-[9px] uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
      style={{ color: c, borderColor: c + "55", background: c + "14" }}
    >
      {held ? "HELD" : "READY"}
    </span>
  );
}

const REPORT_GLYPH: Record<string, string> = {
  dashboard: "▦", trend: "↗", gavel: "⚖", scroll: "§", bell: "◷",
};

/* ---------- left rail: deliverable queue ---------- */
export function ReportList({
  reports,
  active,
  onSel,
}: {
  reports: Report[];
  active: string;
  onSel: (id: string) => void;
}) {
  return (
    <Panel title="Committee Deliverables" className="w-[272px] shrink-0">
      <div className="p-1.5 flex flex-col gap-1">
        {reports.map((r) => {
          const sel = r.id === active;
          return (
            <button
              key={r.id}
              onClick={() => onSel(r.id)}
              className={
                "w-full flex items-start gap-2.5 px-2.5 py-2 rounded border text-left transition-caos " +
                (sel
                  ? "border-caos-accent/70 bg-caos-elevated"
                  : "border-transparent hover:border-caos-border hover:bg-caos-elevated/60")
              }
            >
              <span className={"text-[13px] leading-none mt-px " + (sel ? "text-caos-accent" : "text-caos-muted")}>
                {REPORT_GLYPH[r.icon] || "▤"}
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className={"text-[11px] leading-tight " + (sel ? "text-caos-text font-medium" : "text-caos-text/85")}>
                  {r.title}
                </span>
                <span className="tabular text-[8.5px] text-caos-muted truncate">
                  {r.file}.pdf · {r.sections.length} sections · {citeCount(r)} citations
                </span>
              </span>
              <StatusTag held={!!r.watermark} />
            </button>
          );
        })}
      </div>
      <div className="px-3 py-2.5 border-t border-caos-border flex items-start gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--caos-warning)" }} />
        <span className="text-[9px] leading-relaxed text-caos-muted">
          CP-RENDER assembles deliverables from cleared module outputs. The IC Credit Memo is held by CP-5
          (QA-117 open) — it previews and prints <span className="text-caos-text">watermarked</span> until remediation R-1 lands.
        </span>
      </div>
    </Panel>
  );
}

/* ---------- right rail: lineage ---------- */
const SRC_NAMES_X: Record<string, string> = { MKT: "Market data feed", "M-118": "Cash-flow model M-118" };
function srcName(chip: string): string {
  const id = chip.split(" ")[0];
  return MODULE_NAMES[id] || SRC_NAMES_X[chip] || SRC_NAMES_X[id] || "render input";
}

export function LineagePanel({ rep, onOpenEvidence }: { rep: Report; onOpenEvidence: (id: string) => void }) {
  return (
    <Panel title="Lineage — built from">
      <div className="flex flex-col">
        {rep.srcs.map((s) => (
          <div key={s.chip} className="flex items-center gap-2 px-3 py-[7px] border-b border-caos-border/60">
            <span className="tabular text-[9px] text-caos-accent w-[84px] shrink-0 whitespace-nowrap">{s.chip}</span>
            <span className="text-[9.5px] text-caos-muted flex-1 truncate">{srcName(s.chip)}</span>
            <span className="flex gap-1 shrink-0">
              {s.ev.map((e) => (
                <EvChip key={e} id={e} onOpen={onOpenEvidence} />
              ))}
            </span>
          </div>
        ))}
        <div className="px-3 py-2 text-[9px] text-caos-muted leading-relaxed">
          Every figure on the sheet resolves to a producing module and a registered evidence ID (CP-5B map).
        </div>
      </div>
    </Panel>
  );
}

/* ---------- right rail: compose ---------- */
export function ComposePanel({
  rep,
  omit,
  onToggle,
}: {
  rep: Report;
  omit: Record<number, boolean>;
  onToggle: (i: number) => void;
}) {
  const omitted = omit || {};
  const onCount = rep.sections.length - Object.keys(omitted).length;
  return (
    <Panel
      title="Compose"
      right={<span className="tabular text-[9px] text-caos-muted">{onCount}/{rep.sections.length} sections</span>}
    >
      <div className="py-1">
        {rep.sections.map((s: Section, i: number) => {
          const off = !!omitted[i];
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              className="w-full flex items-center gap-2 px-3 py-[5px] hover:bg-caos-elevated/70 text-left transition-caos"
            >
              <span
                className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 text-[8px] leading-none"
                style={{
                  borderColor: off ? "var(--caos-border)" : "var(--caos-accent)",
                  background: off ? "transparent" : "rgba(79,140,255,0.2)",
                  color: "var(--caos-accent)",
                }}
              >
                {!off ? "✓" : null}
              </span>
              <span className={"tabular text-[8.5px] uppercase tracking-wide truncate " + (off ? "text-caos-muted line-through" : "text-caos-muted")}>
                {secLabel(s)}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------- right rail: export ---------- */
export function ExportPanel({ rep, omitCount, editCount }: { rep: Report; omitCount: number; editCount?: number }) {
  const rows: [string, string][] = [
    ["Format", "PDF · US Letter"],
    ["Renderer", "CP-RENDER v2.2"],
    ["Citations", citeCount(rep) + " resolved · 0 orphaned"],
    ["Sections", rep.sections.length - omitCount + " of " + rep.sections.length + " included"],
    ["Analyst edits", editCount ? editCount + " override" + (editCount === 1 ? "" : "s") : "none"],
    ["Watermark", rep.watermark ? "CONDITIONAL — QA-117" : "none"],
  ];
  return (
    <Panel title="Export">
      <div className="p-3 flex flex-col gap-2">
        <div className="flex flex-col">
          {rows.map((r) => (
            <div key={r[0]} className="flex items-baseline justify-between py-1 border-b border-caos-border/50">
              <span className="text-[9px] uppercase tracking-wide text-caos-muted">{r[0]}</span>
              <span
                className={"tabular text-[9.5px] " + (r[0] === "Watermark" && rep.watermark ? "" : "text-caos-text")}
                style={r[0] === "Watermark" && rep.watermark ? { color: "var(--caos-warning)" } : undefined}
              >
                {r[1]}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos flex items-center justify-center gap-2 tabular text-[10px]"
        >
          ⎙ PRINT / SAVE PDF
        </button>
        {rep.watermark ? (
          <div className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--caos-warning)" }} />
            <span className="text-[9px] leading-relaxed text-caos-muted">
              Pack held by CP-5 — export carries the conditional watermark until E-44 is re-anchored (remediation R-1).
            </span>
          </div>
        ) : (
          <span className="text-[9px] text-caos-muted">Clean export — CP-5 trace audit passed (1,142 citations).</span>
        )}
      </div>
    </Panel>
  );
}
