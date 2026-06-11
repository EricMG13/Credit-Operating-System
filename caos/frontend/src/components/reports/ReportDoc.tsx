"use client";

// Concept E — document renderer. Turns the report section DSL into a
// committee-ready paper sheet (styled via rd-* classes in globals.css).

import type { Report, Section, TableRow } from "@/lib/reports/builders";
import { G2Chart } from "@/components/charts/G2Chart";

function RDHead({ title, sub }: { title?: string; sub?: string }) {
  if (!title) return null;
  return (
    <div className="rd-h">
      <span>{title}</span>
      {sub ? <span className="rd-h-sub">{sub}</span> : null}
    </div>
  );
}

function RDTable({ s }: { s: Extract<Section, { t: "table" }> }) {
  const al = s.align || [];
  return (
    <div className="rd-sec">
      <RDHead title={s.title} sub={s.sub} />
      <table className="rd-table">
        <thead>
          <tr>
            {s.cols.map((c, i) => (
              <th key={i} className={al[i] ? "rd-r" : ""}>{c}</th>
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
                  {ci === 0 && !c && r.lbl0 ? <span className="rd-lbl0">{r.lbl0}</span> : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {s.note ? <div className="rd-note">{s.note}</div> : null}
    </div>
  );
}

function RDProfile({ s }: { s: Extract<Section, { t: "profile" }> }) {
  return (
    <div className="rd-sec">
      <RDHead title={s.title} />
      <div className="rd-profile">
        {s.rows.map((r, i) => (
          <div key={i} className={"rd-prow" + (s.boldLast && i === s.rows.length - 1 ? " rd-b" : "")}>
            <span className="rd-plbl">{r[0]}</span>
            <span>{r[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RDText({ s }: { s: Extract<Section, { t: "text" }> }) {
  return (
    <div className="rd-sec">
      <RDHead title={s.title} />
      {s.subhead ? <div className="rd-subhead">{s.subhead}</div> : null}
      <p className="rd-body">{s.body}</p>
      {s.label ? (
        <div className="rd-lblock">
          <span className="rd-lblock-l">{s.label} — </span>
          {s.labelBody}
        </div>
      ) : null}
    </div>
  );
}

function RDList({ s }: { s: Extract<Section, { t: "list" }> }) {
  return (
    <div className="rd-sec">
      <RDHead title={s.title} />
      {s.subhead ? <div className="rd-subhead">{s.subhead}</div> : null}
      <ul className="rd-list">
        {s.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function RDChart({ s }: { s: Extract<Section, { t: "chart" }> }) {
  return (
    <div className="rd-sec">
      <RDHead title={s.title} sub={s.sub} />
      <G2Chart spec={s.spec} height={s.h || 190} mode="paper" />
      {s.note ? <div className="rd-note">{s.note}</div> : null}
    </div>
  );
}

function RDCols({ s }: { s: Extract<Section, { t: "cols" }> }) {
  return (
    <div className="rd-cols">
      {s.items.map((col, i) => (
        <div key={i} className="rd-col" style={{ flex: s.w && s.w[i] != null ? s.w[i] : 1 }}>
          {col.map((x, j) => (
            <RDSection key={j} s={x} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RDSection({ s }: { s: Section }) {
  if (s.t === "table") return <RDTable s={s} />;
  if (s.t === "profile") return <RDProfile s={s} />;
  if (s.t === "text") return <RDText s={s} />;
  if (s.t === "list") return <RDList s={s} />;
  if (s.t === "chart") return <RDChart s={s} />;
  if (s.t === "cols") return <RDCols s={s} />;
  return null;
}

/* ---------- the full sheet ---------- */
export function ReportDoc({
  rep,
  omit,
  paper,
  showSources,
}: {
  rep: Report;
  omit?: Record<number, boolean>;
  paper?: string;
  showSources?: boolean;
}) {
  const secs = rep.sections
    .map((s, i) => ({ s, i }))
    .filter((x) => !(omit && omit[x.i]));
  return (
    <div className="rd-paper" style={{ background: paper || "#f7f5ee" }}>
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
      <h1 className="rd-title">{rep.title}</h1>
      <div className="rd-subtitle">{rep.subtitle}</div>
      <div className="rd-secs">
        {secs.map((x) => (
          <RDSection key={x.i} s={x.s} />
        ))}
      </div>
      {showSources ? (
        <div className="rd-srcline">
          {"SOURCES · " +
            rep.srcs
              .map((s) => s.chip + (s.ev.length ? " [" + s.ev.join(" · ") + "]" : ""))
              .join("   ·   ")}
        </div>
      ) : null}
      <div className="rd-foot">
        <span>Generated by CREDIT OS · CP-RENDER · {rep.file}.pdf</span>
        <span>For internal committee use only — not for distribution</span>
      </div>
    </div>
  );
}
