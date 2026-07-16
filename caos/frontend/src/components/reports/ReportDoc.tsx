"use client";

// Concept E — document renderer. Turns the report section DSL into a
// committee-ready paper sheet (styled via rd-* classes in globals.css).
// Every text leaf is addressable by a stable path so analyst edits can be
// overlaid (edits) and captured inline (onEdit) when edit mode is active.

import type { Report, Section, TableRow } from "@/lib/reports/builders";
import { MODULE_NAMES } from "@/lib/reports/deal";
import { SemanticVisualization, type VisualizationDatum } from "@/components/charts/SemanticVisualization";
import { AuthorityBlock } from "./AuthorityBlock";
import type { DeepDiveCaveatKind } from "@/lib/deepdive/caveat";
import type { ProvFreshness } from "@/lib/provenance";

export type ReportEdits = Record<string, string>;
type OnEdit = (path: string, text: string) => void;
interface EditCtx {
  edits?: ReportEdits;
  onEdit?: OnEdit;
  hideAddbacks?: boolean;
}

/* ---------- editable text leaf ---------- */
// Cap per-field length so a stray large paste can't bloat the deliverable.
const EDIT_MAX_LEN = 2000;
function E({ p, v, ctx, className }: { p: string; v: string | number | null | undefined; ctx: EditCtx; className?: string }) {
  const base = v == null ? "" : String(v);
  const text = ctx.edits && ctx.edits[p] != null ? ctx.edits[p] : base;
  const isModified = ctx.edits && ctx.edits[p] != null && ctx.edits[p] !== base;
  if (!ctx.onEdit) {
    if (!className) return <>{text}</>;
    return <span className={className}>{text}</span>;
  }
  const onEdit = ctx.onEdit;
  const el = (
    <span
      key={p + "|" + text}
      className={className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={`Edit report field ${p}`}
      aria-multiline="true"
      spellCheck={false}
      onPaste={(e) => {
        // Insert plain text only (strip the source's rich HTML/styles) and cap
        // length, so editing the tear-sheet can't inject markup or bloat it.
        e.preventDefault();
        const pasted = e.clipboardData.getData("text/plain").slice(0, EDIT_MAX_LEN);
        document.execCommand("insertText", false, pasted);
      }}
      onBlur={(e) => {
        const t = e.currentTarget.innerText.slice(0, EDIT_MAX_LEN);
        if (t !== text) onEdit(p, t);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.innerText = text;
          e.currentTarget.blur();
        }
      }}
    >
      {text}
    </span>
  );

  if (isModified) {
    return (
      <span className="rd-edit-wrapper relative inline-flex items-center">
        {el}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(p, undefined as unknown as string);
          }}
          title={`Revert override (original: "${base}")`}
          className="rd-revert-dot shrink-0"
          aria-label="Revert override"
        >
          <span className="rd-revert-mark" aria-hidden="true" />
        </button>
      </span>
    );
  }
  return el;
}

function RDHead({ p, title, sub, ctx }: { p: string; title?: string; sub?: string; ctx: EditCtx }) {
  if (!title) return null;
  return (
    <h2 className="rd-h">
      <span><E p={p + ".title"} v={title} ctx={ctx} /></span>
      {sub ? <span className="rd-h-sub"><E p={p + ".sub"} v={sub} ctx={ctx} /></span> : null}
    </h2>
  );
}

function RDTable({ s, p, ctx }: { s: Extract<Section, { t: "table" }>; p: string; ctx: EditCtx }) {
  const al = s.align || [];
  const groupStarts = new Map(s.columnGroups?.map((group) => [group.start, group]) || []);
  const rows = ctx.hideAddbacks && p === "s0"
    ? s.rows.filter((r) => {
        const first = String(r.cells[0] || "");
        return !["Restructuring", "Transaction / non-recurring", "Stock-based comp", "Run-rate synergies", "Pro forma", "less: unrealised"].some((x) => first.startsWith(x));
      })
    : s.rows;
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} sub={s.sub} ctx={ctx} />
      <table aria-label={s.title} className="rd-table">
        <thead>
          <tr>
            {s.cols.map((c, i) => (
              <th
                key={i}
                className={(al[i] ? "rd-r" : "") + (groupStarts.has(i) ? " rd-group-start" : "")}
                data-column-group={groupStarts.get(i)?.key}
                title={groupStarts.get(i) ? `${groupStarts.get(i)!.label} period group` : undefined}
              >
                <E p={p + ".h" + i} v={c} ctx={ctx} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: TableRow, ri: number) => (
            <tr
              key={ri}
              className={
                (r.b ? "rd-b " : "") + (r.it ? "rd-it " : "") +
                (r.line ? "rd-line " : "") + (r.gap ? "rd-gapr" : "")
              }
            >
              {r.cells.map((c, ci) => (
                <td
                  key={ci}
                  className={(al[ci] ? "rd-r rd-num" : "") + (groupStarts.has(ci) ? " rd-group-start" : "")}
                  data-column-group={groupStarts.get(ci)?.key}
                  style={r.cellColors?.[ci] ? { color: r.cellColors[ci] } : undefined}
                >
                  {ci === 0 && !c && r.lbl0
                    ? <E p={p + ".r" + ri + ".lbl0"} v={r.lbl0} ctx={ctx} className="rd-lbl0" />
                    : <E p={p + ".r" + ri + ".c" + ci} v={c} ctx={ctx} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {s.note ? <div className="rd-note"><E p={p + ".note"} v={s.note} ctx={ctx} /></div> : null}
    </div>
  );
}

function RDProfile({ s, p, ctx }: { s: Extract<Section, { t: "profile" }>; p: string; ctx: EditCtx }) {
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} ctx={ctx} />
      <div className="rd-profile">
        {s.rows.map((r, i) => (
          <div key={i} className={"rd-prow" + (s.boldLast && i === s.rows.length - 1 ? " rd-b" : "")}>
            <span className="rd-plbl"><E p={p + ".r" + i + ".l"} v={r[0]} ctx={ctx} /></span>
            <span><E p={p + ".r" + i + ".v"} v={r[1]} ctx={ctx} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RDText({ s, p, ctx }: { s: Extract<Section, { t: "text" }>; p: string; ctx: EditCtx }) {
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} ctx={ctx} />
      {s.subhead ? <h3 className="rd-subhead"><E p={p + ".subhead"} v={s.subhead} ctx={ctx} /></h3> : null}
      <p className="rd-body"><E p={p + ".body"} v={s.body} ctx={ctx} /></p>
      {s.label ? (
        <div className="rd-lblock">
          <span className="rd-lblock-l"><E p={p + ".label"} v={s.label} ctx={ctx} /> — </span>
          <E p={p + ".labelBody"} v={s.labelBody} ctx={ctx} />
        </div>
      ) : null}
    </div>
  );
}

function RDList({ s, p, ctx }: { s: Extract<Section, { t: "list" }>; p: string; ctx: EditCtx }) {
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} ctx={ctx} />
      {s.subhead ? <h3 className="rd-subhead"><E p={p + ".subhead"} v={s.subhead} ctx={ctx} /></h3> : null}
      <ul className="rd-list">
        {s.items.map((it, i) => (
          <li key={i}><E p={p + ".i" + i} v={it} ctx={ctx} /></li>
        ))}
      </ul>
    </div>
  );
}

function RDChart({ s, p, ctx }: { s: Extract<Section, { t: "chart" }>; p: string; ctx: EditCtx }) {
  const { data: chartData = [], ...chart } = s.spec;
  const data = chartData as VisualizationDatum[];
  return (
    <div className="rd-sec">
      <SemanticVisualization
        height={s.h || 190}
        mode="paper"
        spec={{
          kind: s.kind,
          title: s.title,
          unit: s.unit,
          sourceIds: s.sourceIds,
          accessibleSummary: s.accessibleSummary,
          data,
          tabularFallback: { label: `${s.title} data`, columns: s.columns, data },
          chart,
        }}
      />
      {s.note ? <div className="rd-note"><E p={p + ".note"} v={s.note} ctx={ctx} /></div> : null}
    </div>
  );
}

function RDCols({ s, p, ctx }: { s: Extract<Section, { t: "cols" }>; p: string; ctx: EditCtx }) {
  return (
    <div className="rd-cols">
      {s.items.map((col, i) => (
        <div key={i} className="rd-col" style={{ flex: s.w && s.w[i] != null ? s.w[i] : 1 }}>
          {col.map((x, j) => (
            <RDSection key={j} s={x} p={p + ".c" + i + ".s" + j} ctx={ctx} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RDSection({ s, p, ctx }: { s: Section; p: string; ctx: EditCtx }) {
  if (s.t === "table") return <RDTable s={s} p={p} ctx={ctx} />;
  if (s.t === "profile") return <RDProfile s={s} p={p} ctx={ctx} />;
  if (s.t === "text") return <RDText s={s} p={p} ctx={ctx} />;
  if (s.t === "list") return <RDList s={s} p={p} ctx={ctx} />;
  if (s.t === "chart") return <RDChart s={s} p={p} ctx={ctx} />;
  if (s.t === "cols") return <RDCols s={s} p={p} ctx={ctx} />;
  return null;
}

/* ---------- citations-on-paper: numbered evidence register ---------- */
function citeModuleName(chip: string): string {
  const id = chip.split(" ")[0];
  const X: Record<string, string> = { MKT: "Market data feed", "M-118": "Cash-flow model M-118" };
  return MODULE_NAMES[id] || X[chip] || X[id] || "render input";
}

function RDSources({ srcs, onOpenEvidence }: { srcs: Report["srcs"]; onOpenEvidence?: (id: string) => void }) {
  return (
    <div className="rd-sources">
      <div className="rd-sources-h">SOURCES</div>
      <ol>
        {srcs.map((s) => (
          <li key={s.chip}>
            <span className="rd-src-chip">{s.chip}</span>
            <span className="rd-src-name">{citeModuleName(s.chip)}</span>
            {s.ev.map((id) =>
              onOpenEvidence ? (
                <button
                  key={id}
                  type="button"
                  className="rd-cite"
                  onClick={() => onOpenEvidence(id)}
                  title={"Open source " + id}
                  aria-label={"Open source " + id}
                >
                  <span className="rd-cite-chip">{id}</span>
                </button>
              ) : (
                <sup key={id} className="rd-cite-chip rd-cite-print">
                  {id}
                </sup>
              )
            )}
            {!s.ev.length ? <span className="rd-cite-none">no registered evidence id</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- the full sheet ---------- */
export function ReportDoc({
  rep,
  omit,
  paper,
  showSources,
  edits,
  onEdit,
  editableSectionCount,
  hideAddbacks,
  onOpenEvidence,
  authority,
}: {
  rep: Report;
  omit?: Record<number, boolean>;
  paper?: string;
  showSources?: boolean;
  edits?: ReportEdits;
  onEdit?: OnEdit;
  /** When set, only root sections below this server-owned boundary are
      editable. Appended identity/model sections remain visible and immutable. */
  editableSectionCount?: number;
  hideAddbacks?: boolean;
  onOpenEvidence?: (id: string) => void;
  /** Origin/Method/Freshness/QA for the printed authority block — omit to
      fall back to the old blanket "reference template" disclaimer (callers
      that haven't been updated yet). */
  authority?: { caveatKind: DeepDiveCaveatKind; liveRunBacked: boolean; runId?: string | null; qaNote?: string | null; freshness?: ProvFreshness; freshnessDetail?: string | null };
}) {
  const boundedEdits = editableSectionCount == null || !edits
    ? edits
    : Object.fromEntries(Object.entries(edits).filter(([path]) => {
        const match = /^s(\d+)(?:\.|$)/.exec(path);
        return !match || Number(match[1]) < editableSectionCount;
      }));
  const ctx: EditCtx = { edits: boundedEdits, onEdit, hideAddbacks };
  const immutableCtx: EditCtx = { hideAddbacks };
  const isModelAppendix = rep.id === "model";
  const overrideN = boundedEdits ? Object.keys(boundedEdits).length : 0;
  const colophonText = [
    overrideN > 0 ? overrideN + " analyst override" + (overrideN === 1 ? "" : "s") + " applied" : null,
    hideAddbacks ? "EBITDA add-back detail suppressed" : null,
  ].filter(Boolean).join(" · ");
  const secs = rep.sections
    .map((s, i) => ({ s, i }))
    .filter((x) => !(omit && omit[x.i]));

  const hasPages = rep.sections.some(s => s.page);

  if (hasPages) {
    const pages: { name: string; items: typeof secs }[] = [];
    secs.forEach((x) => {
      const pageName = x.s.page || "Page Group";
      let p = pages.find((pg) => pg.name === pageName);
      if (!p) {
        p = { name: pageName, items: [] };
        pages.push(p);
      }
      p.items.push(x);
    });

    return (
      <div
        className={"rd-paper" + (onEdit ? " rd-editing" : "")}
        style={{ background: paper || "#f7f5ee" }}
      >
        {rep.watermark ? (
          <div className="rd-wm" aria-hidden="true">
            <span>{rep.watermark}</span>
            <span>{rep.watermark}</span>
            <span>{rep.watermark}</span>
          </div>
        ) : null}

        {/* Authority block — the paged IC memo is the deliverable most likely
            handed to committee; stamp it so a printed PDF is never mistaken for a
            live issuer run when it isn't one. (#19, P2-WP-8) Kept in normal flow
            so it prints. Falls back to the old blanket claim if no caveat state
            was supplied (defensive — every current caller passes one). */}
        {authority ? (
          <AuthorityBlock {...authority} />
        ) : (
          <div
            role="note"
            style={{
              margin: "6px 0", padding: "4px 8px", border: "1px solid var(--caos-critical)",
              color: "#b91c1c", fontSize: "10px", letterSpacing: "0.05em",
              textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)",
            }}
          >
            Reference template — Atlas Forge Industrials fixture · illustrative committee format, not a live issuer run
          </div>
        )}

        {pages.map((pg, pi) => (
          <div key={pg.name} className="rd-page-container border-b border-dashed border-caos-border/40 pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
            <div className="rd-mast">
              <span className="rd-mast-brand">
                <span className="rd-mark">C</span>
                <span>CAOS · IC CREDIT MEMO · {pg.name.toUpperCase()}</span>
              </span>
              <span className="rd-mast-meta">RUN #2641 · JUN 10, 2026 · PAGE {pi + 1} of {pages.length}</span>
            </div>

            {pi === 0 && (
              <>
                <h1 className="rd-title"><E p="title" v={rep.title} ctx={ctx} /></h1>
                <div className="rd-subtitle"><E p="subtitle" v={rep.subtitle} ctx={ctx} /></div>
              </>
            )}

            <div className="rd-secs mt-4">
              {pg.items.map((x) => (
                <RDSection
                  key={x.i}
                  s={x.s}
                  p={"s" + x.i}
                  ctx={editableSectionCount == null || x.i < editableSectionCount ? ctx : immutableCtx}
                />
              ))}
            </div>
          </div>
        ))}

        {showSources ? <RDSources srcs={rep.srcs} onOpenEvidence={onOpenEvidence} /> : null}

        {colophonText ? <div className="rd-colophon">{colophonText}</div> : null}

        <div className="rd-foot">
          <span>Generated by CAOS · CP-RENDER · {rep.file}.pdf</span>
          <span>For internal committee use only — not for distribution</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"rd-paper" + (onEdit ? " rd-editing" : "") + (isModelAppendix ? " rd-model-appendix" : "")}
      style={{ background: paper || "#f7f5ee" }}
    >
      {rep.watermark ? (
        <div className="rd-wm" aria-hidden="true">
          <span>{rep.watermark}</span>
          <span>{rep.watermark}</span>
          <span>{rep.watermark}</span>
        </div>
      ) : null}
      {isModelAppendix ? null : (
        <div className="rd-mast">
          <span className="rd-mast-brand">
            <span className="rd-mark">C</span>
            <span>CAOS · CREDIT RESEARCH</span>
          </span>
          <span className="rd-mast-meta">RUN #2641 · JUN 10, 2026 · INTERNAL USE</span>
        </div>
      )}
      {/* Authority block — origin/method/QA derived from the real caveat state,
          not a blanket "not live" claim, so an exported PDF stays accurate
          when the figures ARE live-backed (FE-5). (#19, P2-WP-8) */}
      {isModelAppendix ? null : authority ? (
        <AuthorityBlock {...authority} />
      ) : (
        <div
          role="note"
          style={{
            margin: "6px 0", padding: "4px 8px", border: "1px solid var(--caos-critical)",
            color: "#b91c1c", fontSize: "10px", letterSpacing: "0.05em",
            textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)",
          }}
        >
          Reference template — Atlas Forge Industrials fixture · illustrative committee format, not a live issuer run
        </div>
      )}
      {/* Model appendix is a dense landscape sheet with no masthead/banner/foot.
          Give it a single compact provenance line so it can't be mistaken for a
          real issuer run. (#19) */}
      {isModelAppendix ? (
        <div className="rd-mast" style={{ borderBottomWidth: 1 }}>
          <span className="rd-mast-brand">
            <span className="rd-mark">C</span>
            <span>CAOS · MODEL APPENDIX · REFERENCE FIXTURE</span>
          </span>
          <span className="rd-mast-meta">RUN #2641 · JUN 10, 2026 · NOT A LIVE ISSUER RUN</span>
        </div>
      ) : null}
      <h1 className="rd-title"><E p="title" v={rep.title} ctx={ctx} /></h1>
      <div className="rd-subtitle"><E p="subtitle" v={rep.subtitle} ctx={ctx} /></div>
      <div className="rd-secs">
        {secs.map((x) => (
          <RDSection
            key={x.i}
            s={x.s}
            p={"s" + x.i}
            ctx={editableSectionCount == null || x.i < editableSectionCount ? ctx : immutableCtx}
          />
        ))}
      </div>
      {showSources && !isModelAppendix ? <RDSources srcs={rep.srcs} onOpenEvidence={onOpenEvidence} /> : null}
      {!isModelAppendix && colophonText ? <div className="rd-colophon">{colophonText}</div> : null}
      {isModelAppendix ? null : (
        <div className="rd-foot">
          <span>Generated by CAOS · CP-RENDER · {rep.file}.pdf</span>
          <span>For internal committee use only — not for distribution</span>
        </div>
      )}
      {isModelAppendix && colophonText ? <div className="rd-colophon">{colophonText}</div> : null}
    </div>
  );
}
