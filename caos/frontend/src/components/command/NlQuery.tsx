"use client";

// Cross-issuer natural-language query (Approach A). The analyst asks a question
// in plain language; the backend translates it into a constrained, validated
// QuerySpec over the curated metric store and returns a ranked, evidence-cited,
// gate-aware answer. Surfaced on the Command Center as the "scan coverage" tool.

import { useState } from "react";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { nlQuery } from "@/lib/api";
import { fmtMetric } from "@/lib/query/format";
import type { MetricCell, NlQueryResult, SemanticResult, StructuredResult } from "@/lib/query/types";

const STARTERS = [
  "which issuers' margins are most exposed to higher inflation in energy prices",
  "which issuer is most levered",
  "which issuers flag energy or input-cost pressure in their filings",
];

function GateBadge({ qa }: { qa: string }) {
  if (qa === "Blocked") return <Pill text="BLOCKED" color="var(--caos-critical)" />;
  if (qa === "Restricted") return <Pill text="RESTRICTED" color="var(--caos-warning)" />;
  return null;
}

function Pill({ text, color, title }: { text: string; color: string; title?: string }) {
  return (
    <span
      title={title}
      className="tabular text-[8px] uppercase tracking-wide px-1 py-px rounded border whitespace-nowrap"
      style={{ color, borderColor: color + "66", background: color + "14" }}
    >
      {text}
    </span>
  );
}

// A single metric value with its provenance signal: run-derived facts carry a
// clickable-looking E-xx citation chip; seed facts read as illustrative.
function Cell({ cell, ranked }: { cell: MetricCell | undefined; ranked: boolean }) {
  if (!cell) return <span className="tabular text-[10px] text-caos-muted">—</span>;
  const cite = cell.citation;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        className="tabular text-[10px]"
        style={{ color: ranked ? "var(--caos-accent)" : "var(--caos-text)", fontWeight: ranked ? 600 : 400 }}
      >
        {fmtMetric(cell.value, cell.unit)}
      </span>
      {cite && cite.evidence_id ? (
        <span
          title={`Cited — claim ${cite.claim_id ?? "?"} · ${cite.evidence_id}${cite.chunk_id ? " · chunk " + cite.chunk_id.slice(0, 8) : ""}`}
          className="tabular text-[8px] px-1 rounded border border-caos-accent/50 text-caos-accent"
        >
          {cite.evidence_id}
        </span>
      ) : ranked && cell.provenance === "seed" ? (
        <span title="Illustrative seed value (no run-derived source yet)" className="tabular text-[8px] text-caos-muted">seed</span>
      ) : null}
    </span>
  );
}

// Structured (metric-ranking) results — the ranked, cited table.
function StructuredView({ res }: { res: StructuredResult }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: 260 }}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th className="tabular text-[8.5px] uppercase tracking-wider text-caos-muted font-normal py-1 pr-2">#</th>
            <th className="tabular text-[8.5px] uppercase tracking-wider text-caos-muted font-normal py-1 pr-2">Issuer</th>
            {res.columns.map((c) => (
              <th
                key={c.key}
                className="tabular text-[8.5px] uppercase tracking-wider font-normal py-1 px-2 text-right whitespace-nowrap"
                style={{ color: c.key === res.rank_by ? "var(--caos-accent)" : "var(--caos-muted)" }}
                title={c.higher_is_better ? "higher is stronger" : "higher is weaker / more exposed"}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {res.rows.map((row, i) => {
            const cells = row.metrics;
            const anyRun = Object.values(cells).some((m) => m.provenance === "run");
            const worstQa = Object.values(cells).map((m) => m.qa_status);
            const qa = worstQa.includes("Blocked") ? "Blocked" : worstQa.includes("Restricted") ? "Restricted" : "ok";
            return (
              <tr key={row.issuer.id} className="border-t border-caos-border/60">
                <td className="tabular text-[10px] text-caos-muted py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-caos-text whitespace-nowrap">{row.issuer.name}</span>
                    {row.issuer.ticker ? <span className="tabular text-[8.5px] text-caos-muted">{row.issuer.ticker}</span> : null}
                    <Pill
                      text={anyRun ? "CP-1 LIVE" : "SEEDED"}
                      color={anyRun ? "var(--caos-success)" : "var(--caos-idle)"}
                      title={anyRun ? "Financials are run-derived and cited." : "Illustrative seed values (no run yet)."}
                    />
                    <GateBadge qa={qa} />
                  </div>
                </td>
                {res.columns.map((c) => (
                  <td key={c.key} className="py-1.5 px-2 text-right">
                    <Cell cell={cells[c.key]} ranked={c.key === res.rank_by} />
                  </td>
                ))}
              </tr>
            );
          })}
          {!res.rows.length ? (
            <tr><td colSpan={res.columns.length + 2} className="tabular text-[10px] text-caos-muted py-2">No issuers matched.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// Semantic (evidence-retrieval) results — issuers grouped by document match, each
// with cited source excerpts (the qualitative counterpart to the metric table).
function SemanticView({ res }: { res: SemanticResult }) {
  if (!res.rows.length) {
    return <div className="tabular text-[10px] text-caos-muted py-1">No issuer documents matched.</div>;
  }
  return (
    <div className="flex flex-col gap-2 overflow-auto" style={{ maxHeight: 300 }}>
      {res.rows.map((row, i) => (
        <div key={row.issuer.id} className="rounded border border-caos-border/70 bg-caos-bg/40">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-caos-border/50">
            <span className="tabular text-[10px] text-caos-muted">{i + 1}</span>
            <span className="text-[10px] text-caos-text whitespace-nowrap">{row.issuer.name}</span>
            {row.issuer.ticker ? <span className="tabular text-[8.5px] text-caos-muted">{row.issuer.ticker}</span> : null}
            {row.issuer.industry ? <span className="tabular text-[8.5px] text-caos-muted">· {row.issuer.industry}</span> : null}
            <div className="flex-1" />
            <Pill text="EVIDENCE" color="var(--caos-accent)" title="Matched in the issuer's source documents" />
          </div>
          <div className="flex flex-col gap-1.5 px-2 py-1.5">
            {row.excerpts.map((ex) => (
              <div key={ex.chunk_id} className="pl-2 border-l-2 border-caos-accent/40">
                <div className="tabular text-[8px] uppercase tracking-wide text-caos-muted mb-0.5">{ex.doc}</div>
                <div className="text-[10px] text-caos-text/90 leading-relaxed">&ldquo;{ex.text}&rdquo;</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NlQuery() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<NlQueryResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    if (text) setQ(text);
    setBusy(true);
    setErr(null);
    try {
      setRes(await nlQuery(question));
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as Error)?.message || "query failed";
      setErr(String(detail));
      setRes(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Ask across issuers · cross-issuer query"
      className="shrink-0"
      right={<span className="tabular text-[9px] text-caos-muted">grounded in the metric store · cited where run-derived</span>}
    >
      <div className="p-2.5 flex flex-col gap-2">
        {/* input */}
        <div className="flex items-center gap-2">
          <span className="text-caos-accent text-[12px]">✦</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
            placeholder="Ask across issuers — e.g. which margins are most exposed to energy-price inflation"
            className="flex-1 bg-caos-bg border border-caos-border rounded px-2.5 py-1.5 text-[11px] text-caos-text placeholder:text-caos-muted outline-none focus:border-caos-accent/70 transition-caos"
          />
          <button
            onClick={() => run()}
            disabled={busy || !q.trim()}
            className="shrink-0 tabular text-[10px] px-3 py-1.5 rounded transition-caos disabled:opacity-40"
            style={{ background: "var(--caos-accent)", color: "#0a0a0f" }}
          >
            {busy ? "…" : "ASK"}
          </button>
        </div>

        {/* starters (only before a result) */}
        {!res && !busy ? (
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => run(s)}
                className="tabular text-[9px] px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {err ? (
          <div className="tabular text-[10px] px-2 py-1.5 rounded border" style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.5)", background: "rgba(245,165,36,0.08)" }}>
            ⚠ {err}
          </div>
        ) : null}

        {res ? (
          <div className="flex flex-col gap-2">
            {/* interpretation — show the analyst exactly how the question was read */}
            <div className="tabular text-[10px] text-caos-muted leading-snug">
              <span className="uppercase tracking-wider text-caos-micro text-caos-accent mr-1.5">Reading</span>
              {res.interpretation}
            </div>

            {res.mode === "structured" ? <StructuredView res={res} /> : <SemanticView res={res} />}

            {/* caveats — honesty about seed vs run-derived / qualitative match */}
            {res.caveats.length ? (
              <div className="tabular text-[9px] text-caos-muted leading-snug">
                {res.caveats.map((c, i) => <div key={i}>· {c}</div>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </PanelShell>
  );
}
