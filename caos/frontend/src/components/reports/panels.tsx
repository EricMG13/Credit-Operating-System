"use client";

// Report Studio rail panels (port of design bundle concept-e.jsx):
// left deliverable queue + right lineage / compose / export rails.

import type { Report, Section } from "@/lib/reports/builders";
import { citeCount, secLabel } from "@/lib/reports/builders";
import { MODULE_NAMES } from "@/lib/reports/deal";
import { sevSurface } from "@/lib/pipeline/sev";
import { EvChip } from "./EvidenceModal";
import { ExportToVaultButton } from "./ExportToVaultButton";
import { Panel } from "@/components/shared/Panel";

function StatusTag({ held }: { held: boolean }) {
  return (
    <span
      className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
      style={sevSurface(held ? "warning" : "ok", { border: 33, wash: 8 })}
    >
      {held ? "HELD" : "READY"}
    </span>
  );
}

const REPORT_GLYPH: Record<string, string> = {
  dashboard: "▦", trend: "↗", gavel: "⚖", scroll: "§", bell: "◷",
};

const plural = (n: number, w: string) => n + " " + w + (n === 1 ? "" : "s");

/* ---------- left rail: deliverable queue ---------- */
export function ReportList({
  reports,
  active,
  onSel,
  onCollapse,
}: {
  reports: Report[];
  active: string;
  onSel: (id: string) => void;
  onCollapse?: () => void;
}) {
  return (
    <Panel
      title="Committee Deliverables"
      className="w-[272px] shrink-0"
      right={onCollapse ? <button onClick={onCollapse} className="tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring">COLLAPSE</button> : undefined}
    >
      <div className="p-1.5 flex flex-col gap-1">
        {reports.map((r) => {
          const sel = r.id === active;
          return (
            <button
              key={r.id}
              onClick={() => onSel(r.id)}
              aria-current={sel ? "true" : undefined}
              className={
                "w-full flex items-start gap-2.5 px-2.5 py-2 rounded border text-left transition-caos " +
                (sel
                  ? "border-caos-accent/70 bg-caos-elevated"
                  : "border-transparent hover:border-caos-border hover:bg-caos-elevated/60")
              }
            >
              <span className={"text-caos-xl leading-none mt-px " + (sel ? "text-caos-accent" : "text-caos-muted")}>
                {REPORT_GLYPH[r.icon] || "▤"}
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className={"text-caos-xl leading-tight " + (sel ? "text-caos-text font-medium" : "text-caos-text/85")}>
                  {r.title}
                </span>
                <span className="tabular text-caos-2xs text-caos-muted truncate">
                  {plural(r.sections.length, "section")} · {plural(citeCount(r), "citation")}
                </span>
              </span>
              <StatusTag held={!!r.watermark} />
            </button>
          );
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-caos-border flex items-start gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--caos-warning)" }} />
        <span className="text-caos-xs leading-relaxed text-caos-muted">
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
            <span className="tabular text-caos-xs text-caos-accent w-[84px] shrink-0 whitespace-nowrap">{s.chip}</span>
            <span className="text-caos-sm text-caos-muted flex-1 truncate">{srcName(s.chip)}</span>
            <span className="flex gap-1 shrink-0">
              {s.ev.map((e) => (
                <EvChip key={e} id={e} onOpen={onOpenEvidence} />
              ))}
            </span>
          </div>
        ))}
        <div className="px-3 py-2 text-caos-xs text-caos-muted leading-relaxed">
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
  const hasPages = rep.sections.some(s => s.page);

  if (hasPages) {
    const groups: { name: string; items: { s: Section; idx: number }[] }[] = [];
    rep.sections.forEach((s, i) => {
      const pageName = s.page || "Page Group";
      let g = groups.find((gr) => gr.name === pageName);
      if (!g) {
        g = { name: pageName, items: [] };
        groups.push(g);
      }
      g.items.push({ s, idx: i });
    });

    return (
      <Panel
        title="Compose"
        right={<span className="tabular text-caos-xs text-caos-muted">{onCount}/{rep.sections.length} sections</span>}
      >
        <div className="flex flex-col gap-3 p-2">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col border border-caos-border bg-caos-panel rounded overflow-hidden">
              <div className="bg-caos-bg px-2 py-1 border-b border-caos-border text-[9px] font-semibold text-caos-accent uppercase tracking-wider">
                {g.name}
              </div>
              <div className="flex flex-col py-1">
                {g.items.map(({ s, idx }) => {
                  const off = !!omitted[idx];
                  return (
                    <button
                      key={idx}
                      onClick={() => onToggle(idx)}
                      aria-pressed={!off}
                      className="w-full flex items-center gap-2 px-2.5 py-[5px] min-h-[24px] hover:bg-caos-elevated/70 text-left transition-caos"
                    >
                      <span
                        className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 text-caos-3xs leading-none"
                        style={{
                          borderColor: off ? "var(--caos-border)" : "var(--caos-accent)",
                          background: off ? "transparent" : "color-mix(in srgb, var(--caos-accent) 20%, transparent)",
                          color: "var(--caos-accent)",
                        }}
                      >
                        {!off ? "✓" : null}
                      </span>
                      <span className={"tabular text-caos-2xs uppercase tracking-wide truncate " + (off ? "text-caos-muted line-through" : "text-caos-muted")}>
                        {secLabel(s)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Compose"
      right={<span className="tabular text-caos-xs text-caos-muted">{onCount}/{rep.sections.length} sections</span>}
    >
      <div className="py-1">
        {rep.sections.map((s: Section, i: number) => {
          const off = !!omitted[i];
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              aria-pressed={!off}
              className="w-full flex items-center gap-2 px-3 py-[5px] min-h-[24px] hover:bg-caos-elevated/70 text-left transition-caos"
            >
              <span
                className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 text-caos-3xs leading-none"
                style={{
                  borderColor: off ? "var(--caos-border)" : "var(--caos-accent)",
                  background: off ? "transparent" : "color-mix(in srgb, var(--caos-accent) 20%, transparent)",
                  color: "var(--caos-accent)",
                }}
              >
                {!off ? "✓" : null}
              </span>
              <span className={"tabular text-caos-2xs uppercase tracking-wide truncate " + (off ? "text-caos-muted line-through" : "text-caos-muted")}>
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
export function ExportPanel({ rep, omitCount, editCount, runId }: { rep: Report; omitCount: number; editCount?: number; runId?: string }) {
  const rows: [string, string][] = [
    ["Format", "PDF · US Letter / XLSX"],
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
              <span className="text-caos-xs uppercase tracking-wide text-caos-muted">{r[0]}</span>
              <span
                className={"tabular text-caos-sm " + (r[0] === "Watermark" && rep.watermark ? "" : "text-caos-text")}
                style={r[0] === "Watermark" && rep.watermark ? { color: "var(--caos-warning)" } : undefined}
              >
                {r[1]}
              </span>
            </div>
          ))}
        </div>
        {/* Print/export is the ONE shell-level primary action (header "⎙ EXPORT
            PDF") — this panel used to duplicate it with its own button
            (P2-WP-8); the metadata above is the panel's job, not a second
            trigger for the same action. */}
        {runId ? <ExportToVaultButton runId={runId} /> : null}
        {rep.watermark ? (
          <div className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--caos-warning)" }} />
            <span className="text-caos-xs leading-relaxed text-caos-muted">
              Pack held by CP-5 — export carries the conditional watermark until E-44 is re-anchored (remediation R-1).
            </span>
          </div>
        ) : (
          <span className="text-caos-xs text-caos-muted">{"Clean export — CP-5 trace audit passed · " + citeCount(rep) + (citeCount(rep) === 1 ? " citation" : " citations") + " resolved."}</span>
        )}
      </div>
    </Panel>
  );
}
