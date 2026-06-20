"use client";

// Concept E — document renderer. Turns the report section DSL into a
// committee-ready paper sheet (styled via rd-* classes in globals.css).
// Every text leaf is addressable by a stable path so analyst edits can be
// overlaid (edits) and captured inline (onEdit) when edit mode is active.

import type { Report, Section, TableRow } from "@/lib/reports/builders";
import { G2Chart } from "@/components/charts/G2Chart";

export type ReportEdits = Record<string, string>;
type OnEdit = (path: string, text: string) => void;
interface EditCtx {
  edits?: ReportEdits;
  onEdit?: OnEdit;
}

/* ---------- editable text leaf ---------- */
// Cap per-field length so a stray large paste can't bloat the deliverable.
const EDIT_MAX_LEN = 2000;
function E({ p, v, ctx, className }: { p: string; v: string | number | null | undefined; ctx: EditCtx; className?: string }) {
  const base = v == null ? "" : String(v);
  const text = ctx.edits && ctx.edits[p] != null ? ctx.edits[p] : base;
  if (!ctx.onEdit) {
    if (!className) return <>{text}</>;
    return <span className={className}>{text}</span>;
  }
  const onEdit = ctx.onEdit;
  return (
    <span
      key={p + "|" + text}
      className={className}
      contentEditable
      suppressContentEditableWarning
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
}

function RDHead({ p, title, sub, ctx }: { p: string; title?: string; sub?: string; ctx: EditCtx }) {
  if (!title) return null;
  return (
    <div className="rd-h">
      <span><E p={p + ".title"} v={title} ctx={ctx} /></span>
      {sub ? <span className="rd-h-sub"><E p={p + ".sub"} v={sub} ctx={ctx} /></span> : null}
    </div>
  );
}

function RDTable({ s, p, ctx }: { s: Extract<Section, { t: "table" }>; p: string; ctx: EditCtx }) {
  const al = s.align || [];
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} sub={s.sub} ctx={ctx} />
      <table aria-label={s.title} className="rd-table">
        <thead>
          <tr>
            {s.cols.map((c, i) => (
              <th key={i} className={al[i] ? "rd-r" : ""}><E p={p + ".h" + i} v={c} ctx={ctx} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r: TableRow, ri: number) => (
            <tr
              key={ri}
              className={
                (r.b ? "rd-b " : "") + (r.it ? "rd-it " : "") +
                (r.line ? "rd-line " : "") + (r.gap ? "rd-gapr" : "")
              }
            >
              {r.cells.map((c, ci) => (
                <td key={ci} className={al[ci] ? "rd-r rd-num" : ""}>
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
      {s.subhead ? <div className="rd-subhead"><E p={p + ".subhead"} v={s.subhead} ctx={ctx} /></div> : null}
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
      {s.subhead ? <div className="rd-subhead"><E p={p + ".subhead"} v={s.subhead} ctx={ctx} /></div> : null}
      <ul className="rd-list">
        {s.items.map((it, i) => (
          <li key={i}><E p={p + ".i" + i} v={it} ctx={ctx} /></li>
        ))}
      </ul>
    </div>
  );
}

function RDChart({ s, p, ctx }: { s: Extract<Section, { t: "chart" }>; p: string; ctx: EditCtx }) {
  return (
    <div className="rd-sec">
      <RDHead p={p} title={s.title} sub={s.sub} ctx={ctx} />
      <G2Chart spec={s.spec} height={s.h || 190} mode="paper" />
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

/* ---------- the full sheet ---------- */
export function ReportDoc({
  rep,
  omit,
  paper,
  showSources,
  edits,
  onEdit,
}: {
  rep: Report;
  omit?: Record<number, boolean>;
  paper?: string;
  showSources?: boolean;
  edits?: ReportEdits;
  onEdit?: OnEdit;
}) {
  const ctx: EditCtx = { edits, onEdit };
  const secs = rep.sections
    .map((s, i) => ({ s, i }))
    .filter((x) => !(omit && omit[x.i]));
  const srcline =
    "SOURCES · " +
    rep.srcs
      .map((s) => s.chip + (s.ev.length ? " [" + s.ev.join(" · ") + "]" : ""))
      .join("   ·   ");
  return (
    <div className={"rd-paper" + (onEdit ? " rd-editing" : "")} style={{ background: paper || "#f7f5ee" }}>
      {rep.watermark ? (
        <div className="rd-wm" aria-hidden="true">
          <span>{rep.watermark}</span>
          <span>{rep.watermark}</span>
          <span>{rep.watermark}</span>
        </div>
      ) : null}
      <div className="rd-mast">
        <span className="rd-mast-brand">
          <span className="rd-mark">C</span>
          <span>CREDIT OS · CREDIT RESEARCH</span>
        </span>
        <span className="rd-mast-meta">RUN #2641 · JUN 10, 2026 · INTERNAL USE</span>
      </div>
      <h1 className="rd-title"><E p="title" v={rep.title} ctx={ctx} /></h1>
      <div className="rd-subtitle"><E p="subtitle" v={rep.subtitle} ctx={ctx} /></div>
      <div className="rd-secs">
        {secs.map((x) => (
          <RDSection key={x.i} s={x.s} p={"s" + x.i} ctx={ctx} />
        ))}
      </div>
      {showSources ? (
        <div className="rd-srcline">
          <E p="srcline" v={srcline} ctx={ctx} />
        </div>
      ) : null}
      <div className="rd-foot">
        <span>Generated by CREDIT OS · CP-RENDER · {rep.file}.pdf</span>
        <span>For internal committee use only — not for distribution</span>
      </div>
    </div>
  );
}
