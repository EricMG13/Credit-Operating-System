"use client";

// Concept E — document renderer. Turns the report section DSL into a
// committee-ready paper sheet (styled via rd-* classes in globals.css).
// Every text leaf is addressable by a stable path so analyst edits can be
// overlaid (edits) and captured inline (onEdit) when edit mode is active.

import type { Report, Section, TableRow } from "@/lib/reports/builders";
import { MODULE_NAMES } from "@/lib/reports/deal";
import { SemanticVisualization, type VisualizationDatum } from "@/components/charts/SemanticVisualization";
import { ReportAuthority } from "./AuthorityBlock";
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
      onInput={(e) => {
        // Let native paste complete, then normalize any inserted rich markup
        // to capped plain text. This preserves paste/clipboard affordances while
        // preventing styled source content from entering the tear-sheet.
        const target = e.currentTarget;
        const raw = target.innerText ?? target.textContent ?? "";
        const hasMarkup = Array.from(target.childNodes).some((node) => node.nodeType === Node.ELEMENT_NODE);
        if (!hasMarkup && raw.length <= EDIT_MAX_LEN) return;
        target.replaceChildren(document.createTextNode(raw.slice(0, EDIT_MAX_LEN)));
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
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
                {c
                  ? <E p={p + ".h" + i} v={c} ctx={ctx} />
                  : <span className="sr-only">{i === 0 ? "Line item" : `Column ${i + 1}`}</span>}
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
              {r.cells.map((c, ci) => {
                const content = ci === 0 && !c && r.lbl0
                  ? <E p={p + ".r" + ri + ".lbl0"} v={r.lbl0} ctx={ctx} className="rd-lbl0" />
                  : <E p={p + ".r" + ri + ".c" + ci} v={c} ctx={ctx} />;
                const cellProps = {
                  className: (al[ci] ? "rd-r rd-num" : "") + (groupStarts.has(ci) ? " rd-group-start" : ""),
                  "data-column-group": groupStarts.get(ci)?.key,
                  style: r.cellColors?.[ci] ? { color: r.cellColors[ci] } : undefined,
                };
                return ci === 0
                  ? <th key={ci} scope="row" {...cellProps}>{content}</th>
                  : <td key={ci} {...cellProps}>{content}</td>;
              })}
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

function RDSubhead({ p, value, ctx }: { p: string; value?: string; ctx: EditCtx }) {
  return value ? <h3 className="rd-subhead"><E p={p + ".subhead"} v={value} ctx={ctx} /></h3> : null;
}

function RDText({ s, p, ctx }: { s: Extract<Section, { t: "text" }>; p: string; ctx: EditCtx }) {
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} ctx={ctx} />
      <RDSubhead p={p} value={s.subhead} ctx={ctx} />
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
      <RDSubhead p={p} value={s.subhead} ctx={ctx} />
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
interface ReportAuthority {
  caveatKind: DeepDiveCaveatKind;
  liveRunBacked: boolean;
  runId?: string | null;
  qaNote?: string | null;
  freshness?: ProvFreshness;
  freshnessDetail?: string | null;
}

interface ReportDocProps {
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
  authority?: ReportAuthority;
}

type IndexedSection = { s: Section; i: number };
type ReportPage = { name: string; items: IndexedSection[] };

interface ReportRenderState {
  colophonText: string;
  ctx: EditCtx;
  immutableCtx: EditCtx;
  isModelAppendix: boolean;
  mastRunLabel: string;
  sections: IndexedSection[];
}

function boundedReportEdits(edits: ReportEdits | undefined, editableSectionCount: number | undefined) {
  if (editableSectionCount == null || !edits) return edits;
  return Object.fromEntries(Object.entries(edits).filter(([path]) => {
    const match = /^s(\d+)(?:\.|$)/.exec(path);
    return !match || Number(match[1]) < editableSectionCount;
  }));
}

function reportColophon(edits: ReportEdits | undefined, hideAddbacks: boolean | undefined) {
  const overrideCount = edits ? Object.keys(edits).length : 0;
  const overrideText = overrideCount > 0 ? `${overrideCount} analyst override${overrideCount === 1 ? "" : "s"} applied` : null;
  return [overrideText, hideAddbacks ? "EBITDA add-back detail suppressed" : null].filter(Boolean).join(" · ");
}

function visibleReportSections(rep: Report, omit: Record<number, boolean> | undefined) {
  return rep.sections.map((s, i) => ({ s, i })).filter((item) => !omit?.[item.i]);
}

function prepareReportState(props: ReportDocProps): ReportRenderState {
  const boundedEdits = boundedReportEdits(props.edits, props.editableSectionCount);
  return {
    colophonText: reportColophon(boundedEdits, props.hideAddbacks),
    ctx: { edits: boundedEdits, onEdit: props.onEdit, hideAddbacks: props.hideAddbacks },
    immutableCtx: { hideAddbacks: props.hideAddbacks },
    isModelAppendix: props.rep.id === "model",
    mastRunLabel: props.authority?.runId ? `RUN ${props.authority.runId.slice(0, 8).toUpperCase()}` : "REFERENCE",
    sections: visibleReportSections(props.rep, props.omit),
  };
}

function groupReportPages(sections: IndexedSection[]) {
  const pages: ReportPage[] = [];
  for (const item of sections) {
    const name = item.s.page || "Page Group";
    let page = pages.find((candidate) => candidate.name === name);
    if (!page) {
      page = { name, items: [] };
      pages.push(page);
    }
    page.items.push(item);
  }
  return pages;
}

function sectionEditContext(item: IndexedSection, props: ReportDocProps, state: ReportRenderState) {
  return props.editableSectionCount == null || item.i < props.editableSectionCount ? state.ctx : state.immutableCtx;
}

function ReportWatermark({ watermark }: { watermark: string | undefined }) {
  if (!watermark) return null;
  return <div className="rd-wm" aria-hidden="true"><span>{watermark}</span><span>{watermark}</span><span>{watermark}</span></div>;
}

function ReferenceAuthorityNote() {
  return <div
    role="note"
    style={{
      margin: "6px 0", padding: "4px 8px", border: "1px solid var(--caos-critical)",
      color: "#b91c1c", fontSize: "10px", letterSpacing: "0.05em",
      textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)",
    }}
  >Reference template — Atlas Forge Industrials fixture · illustrative committee format, not a live issuer run</div>;
}

function ReportAuthorityBlock({ authority }: { authority: ReportAuthority | undefined }) {
  return authority ? <ReportAuthority {...authority} /> : <ReferenceAuthorityNote />;
}

function ReportTitle({ rep, ctx }: { rep: Report; ctx: EditCtx }) {
  return <><h1 className="rd-title"><E p="title" v={rep.title} ctx={ctx} /></h1><div className="rd-subtitle"><E p="subtitle" v={rep.subtitle} ctx={ctx} /></div></>;
}

function ReportSections({ sections, props, state, paged = false }: { sections: IndexedSection[]; props: ReportDocProps; state: ReportRenderState; paged?: boolean }) {
  return <div className={paged ? "rd-secs mt-4" : "rd-secs"}>
    {sections.map((item) => <RDSection key={item.i} s={item.s} p={`s${item.i}`} ctx={sectionEditContext(item, props, state)} />)}
  </div>;
}

function ReportFooter({ file }: { file: string }) {
  return <div className="rd-foot"><span>Generated by CAOS · CP-RENDER · {file}.pdf</span><span>For internal committee use only — not for distribution</span></div>;
}

function ReportColophon({ text }: { text: string }) {
  return text ? <div className="rd-colophon">{text}</div> : null;
}

function PagedReportPage({ page, pageIndex, pages, props, state }: { page: ReportPage; pageIndex: number; pages: ReportPage[]; props: ReportDocProps; state: ReportRenderState }) {
  return <div className="rd-page-container border-b border-dashed border-caos-border/40 pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
    <div className="rd-mast">
      <span className="rd-mast-brand"><span className="rd-mark">C</span><span>CAOS · IC CREDIT MEMO · {page.name.toUpperCase()}</span></span>
      <span className="rd-mast-meta">{state.mastRunLabel} · PAGE {pageIndex + 1} of {pages.length}</span>
    </div>
    {pageIndex === 0 ? <ReportTitle rep={props.rep} ctx={state.ctx} /> : null}
    <ReportSections sections={page.items} props={props} state={state} paged />
  </div>;
}

function PagedReport({ props, state }: { props: ReportDocProps; state: ReportRenderState }) {
  const pages = groupReportPages(state.sections);
  const paperClass = `rd-paper${props.onEdit ? " rd-editing" : ""}`;
  return <div className={paperClass} style={{ background: props.paper || "#f7f5ee" }}>
    <ReportWatermark watermark={props.rep.watermark} />
    <ReportAuthorityBlock authority={props.authority} />
    {pages.map((page, index) => <PagedReportPage key={page.name} page={page} pageIndex={index} pages={pages} props={props} state={state} />)}
    {props.showSources ? <RDSources srcs={props.rep.srcs} onOpenEvidence={props.onOpenEvidence} /> : null}
    <ReportColophon text={state.colophonText} />
    <ReportFooter file={props.rep.file} />
  </div>;
}

function ResearchMasthead({ mastRunLabel }: { mastRunLabel: string }) {
  return <div className="rd-mast">
    <span className="rd-mast-brand"><span className="rd-mark">C</span><span>CAOS · CREDIT RESEARCH</span></span>
    <span className="rd-mast-meta">{mastRunLabel} · INTERNAL USE</span>
  </div>;
}

function ModelMasthead({ authority, mastRunLabel }: { authority: ReportAuthority | undefined; mastRunLabel: string }) {
  return <div className="rd-mast" style={{ borderBottomWidth: 1 }}>
    <span className="rd-mast-brand"><span className="rd-mark">C</span><span>CAOS · MODEL APPENDIX · REFERENCE FIXTURE</span></span>
    <span className="rd-mast-meta">{mastRunLabel} · {authority?.liveRunBacked ? "LIVE ISSUER RUN" : "NOT A LIVE ISSUER RUN"}</span>
  </div>;
}

function FlatReportHeader({ props, state }: { props: ReportDocProps; state: ReportRenderState }) {
  if (state.isModelAppendix) return <ModelMasthead authority={props.authority} mastRunLabel={state.mastRunLabel} />;
  return <><ResearchMasthead mastRunLabel={state.mastRunLabel} /><ReportAuthorityBlock authority={props.authority} /></>;
}

function FlatReportTail({ props, state }: { props: ReportDocProps; state: ReportRenderState }) {
  if (state.isModelAppendix) return <ReportColophon text={state.colophonText} />;
  return <>
    {props.showSources ? <RDSources srcs={props.rep.srcs} onOpenEvidence={props.onOpenEvidence} /> : null}
    <ReportColophon text={state.colophonText} />
    <ReportFooter file={props.rep.file} />
  </>;
}

function FlatReport({ props, state }: { props: ReportDocProps; state: ReportRenderState }) {
  const editingClass = props.onEdit ? " rd-editing" : "";
  const modelClass = state.isModelAppendix ? " rd-model-appendix" : "";
  return <div className={`rd-paper${editingClass}${modelClass}`} style={{ background: props.paper || "#f7f5ee" }}>
    <ReportWatermark watermark={props.rep.watermark} />
    <FlatReportHeader props={props} state={state} />
    <ReportTitle rep={props.rep} ctx={state.ctx} />
    <ReportSections sections={state.sections} props={props} state={state} />
    <FlatReportTail props={props} state={state} />
  </div>;
}

export function ReportDoc(props: ReportDocProps) {
  const state = prepareReportState(props);
  return props.rep.sections.some((section) => section.page)
    ? <PagedReport props={props} state={state} />
    : <FlatReport props={props} state={state} />;
}
