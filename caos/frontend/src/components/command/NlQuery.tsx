"use client";

// Cross-issuer natural-language query (Approach A). The analyst asks a question
// in plain language; the backend translates it into a constrained, validated
// QuerySpec over the curated metric store and returns a ranked, evidence-cited,
// gate-aware answer. Surfaced on the Command Center as the "scan coverage" tool.

import { Fragment, useMemo, useRef, useState } from "react";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { TextInput } from "@/components/shared/TextInput";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { nlQuery } from "@/lib/api";
import { fmtMetric } from "@/lib/query/format";
import { barSpecFor, narrate } from "@/lib/query/viz";
import { G2Chart } from "@/components/charts/G2Chart";
import { CitationViewer } from "@/components/command/CitationViewer";
import type { MetricCell, NlQueryResult, SemanticResult, StructuredResult, SynthesisResult } from "@/lib/query/types";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";

// Open the click-to-source viewer for a chunk (label = the chip text, e.g. E-CS1).
type OpenCite = (chunkId: string, label?: string | null) => void;

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
      className="tabular text-caos-3xs uppercase tracking-wide px-1 py-px rounded border whitespace-nowrap"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
    >
      {text}
    </span>
  );
}

// A single metric value with its provenance signal: run-derived / derived facts
// carry a clickable citation chip that opens the source chunk; seed reads as
// illustrative.
function Cell({ cell, ranked, onOpenCite }: { cell: MetricCell | undefined; ranked: boolean; onOpenCite: OpenCite }) {
  if (!cell) return <span className="tabular text-caos-md text-caos-muted">—</span>;
  const cite = cell.citation;
  const chipLabel = cite?.evidence_id || (cite?.chunk_id ? "src" : null);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        className="tabular text-caos-md"
        style={{ color: ranked ? "var(--caos-accent)" : "var(--caos-text)", fontWeight: ranked ? 600 : 400 }}
      >
        {fmtMetric(cell.value, cell.unit)}
      </span>
      {cell.provenance === "demo_fixture" ? (
        <span
          title="Fabricated Atlas Forge demo-fixture value — served because no model key is configured for this issuer; NOT sourced from its filings."
          className="tabular text-caos-3xs font-semibold px-1 rounded"
          style={{ color: "var(--caos-critical)", background: "color-mix(in srgb, var(--caos-critical) 12%, transparent)" }}
        >
          fab
        </span>
      ) : cell.provenance === "fixture" ? (
        <span
          title="Demo fixture value (Atlas Forge reference deal — not a real issuer run)"
          className="tabular text-caos-3xs"
          style={{ color: "var(--caos-warning)" }}
        >
          demo
        </span>
      ) : cite && cite.chunk_id && chipLabel ? (
        <button
          onClick={() => onOpenCite(cite.chunk_id!, chipLabel)}
          title={`Open source — ${cite.evidence_id ? "claim " + (cite.claim_id ?? "?") + " · " + cite.evidence_id : "derived from document"} · chunk ${cite.chunk_id.slice(0, 8)}`}
          className="tabular text-caos-3xs px-1 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
        >
          {chipLabel}
        </button>
      ) : ranked && cell.provenance === "seed" ? (
        <span title="Illustrative seed value (no sourced value yet)" className="tabular text-caos-3xs text-caos-muted">seed</span>
      ) : null}
    </span>
  );
}

// Structured (metric-ranking) results — the ranked, cited table.
function StructuredView({ res, onOpenCite }: { res: StructuredResult; onOpenCite: OpenCite }) {
  const [filters, setFilters] = useState<FilterState>({});
  type Row = StructuredResult["rows"][number];
  const filterVals = useMemo<Record<string, (row: Row) => string | number | null | undefined>>(() => {
    const base: Record<string, (row: Row) => string | number | null | undefined> = {
      rank: (row) => res.rows.indexOf(row) + 1,
      issuer: (row) => row.issuer.name,
      ticker: (row) => row.issuer.ticker || "—",
    };
    res.columns.forEach((c) => {
      base[c.key] = (row) => {
        const cell = row.metrics[c.key];
        return cell ? fmtMetric(cell.value, cell.unit) : "—";
      };
    });
    return base;
  }, [res.columns, res.rows]);
  const rows = useColumnFilters(res.rows, filters, filterVals);
  const setFilter = (col: string, values: string[] | undefined) =>
    setFilters((f) => {
      const next = { ...f };
      if (values === undefined) {
        delete next[col];
      } else {
        next[col] = values;
      }
      return next;
    });
  return (
    <div className="overflow-auto" style={{ maxHeight: 260 }}>
      <table aria-label="Ranked query results" className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted font-normal py-1 pr-2">
              <FilterHeader label="Rank" col="rank" rows={res.rows} getValue={filterVals.rank} selected={filters.rank} onChange={setFilter}>#</FilterHeader>
            </th>
            <th className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted font-normal py-1 pr-2">
              <FilterHeader label="Issuer" col="issuer" rows={res.rows} getValue={filterVals.issuer} selected={filters.issuer} onChange={setFilter}>Issuer</FilterHeader>
            </th>
            {res.columns.map((c) => (
              <th
                key={c.key}
                className="tabular text-caos-2xs uppercase tracking-wider font-normal py-1 px-2 text-right whitespace-nowrap"
                style={{ color: c.key === res.rank_by ? "var(--caos-accent)" : "var(--caos-muted)" }}
                title={c.higher_is_better ? "higher is stronger" : "higher is weaker / more exposed"}
              >
                <FilterHeader label={c.label} col={c.key} rows={res.rows} getValue={filterVals[c.key]} selected={filters[c.key]} onChange={setFilter}>
                  {c.label}
                </FilterHeader>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = row.metrics;
            const i = res.rows.indexOf(row);
            const provs = Object.values(cells).map((m) => m.provenance);
            const anyFab = provs.includes("demo_fixture");
            const anyRun = provs.includes("run");
            const anyDerived = provs.includes("derived");
            // Fabricated takes priority over any positive label: one synthetic ATLF
            // cell taints the row's trust, so it must never hide behind a LIVE/DERIVED
            // badge (matches Issuer Profile's "fabricated is always marked" rule). #10
            const badge = anyFab
              ? { text: "FABRICATED", color: "var(--caos-critical)", title: "One or more values are synthetic Atlas Forge demo-fixture data (served with no model key) — NOT sourced from this issuer's filings." }
              : anyRun
              ? { text: "CP-1 LIVE", color: "var(--caos-success)", title: "Financials are run-derived and cited (CP-1)." }
              : anyDerived
              ? { text: "DERIVED", color: "var(--caos-accent)", title: "Includes a value derived from this issuer's filings (cited)." }
              : { text: "SEEDED", color: "var(--caos-muted)", title: "Illustrative seed values (no source yet)." };
            const worstQa = Object.values(cells).map((m) => m.qa_status);
            const qa = worstQa.includes("Blocked") ? "Blocked" : worstQa.includes("Restricted") ? "Restricted" : "ok";
            return (
              <Fragment key={row.issuer.id}>
                <tr className="border-t border-caos-border/60">
                  <td className="tabular text-caos-md text-caos-muted py-1.5 pr-2 align-top">{i + 1}</td>
                  <td className="py-1.5 pr-2 align-top">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-caos-md text-caos-text truncate min-w-0">{row.issuer.name}</span>
                      {row.issuer.ticker ? <span className="tabular text-caos-2xs text-caos-muted">{row.issuer.ticker}</span> : null}
                      <Pill text={badge.text} color={badge.color} title={badge.title} />
                      <GateBadge qa={qa} />
                    </div>
                  </td>
                  {res.columns.map((c) => (
                    <td key={c.key} className="py-1.5 px-2 text-right align-top">
                      <Cell cell={cells[c.key]} ranked={c.key === res.rank_by} onOpenCite={onOpenCite} />
                    </td>
                  ))}
                </tr>
                {/* Hybrid: corroborating excerpt from this issuer's documents */}
                {row.evidence ? (
                  <tr>
                    <td />
                    <td colSpan={res.columns.length + 1} className="pb-1.5 pr-2">
                      <div className="pl-2 border-l-2 border-caos-accent/40">
                        <button
                          onClick={() => onOpenCite(row.evidence!.chunk_id, row.evidence!.doc)}
                          className="tabular text-caos-3xs uppercase tracking-wide text-caos-muted hover:text-caos-accent transition-caos mb-0.5 focus-ring"
                          title="Open source"
                        >
                          {row.evidence.doc}
                        </button>
                        <div className="text-caos-sm text-caos-text/80 leading-relaxed">&ldquo;{row.evidence.text}&rdquo;</div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {!res.rows.length ? (
            <tr><td colSpan={res.columns.length + 2} className="tabular text-caos-md text-caos-muted py-2">No issuers matched.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// Semantic (evidence-retrieval) and synthesis (agent-wiki retrieval) results —
// issuers grouped by match, each with cited source excerpts (the qualitative
// counterpart to the metric table). Same row shape; the pill names the corpus.
function SemanticView({ res, onOpenCite }: { res: SemanticResult | SynthesisResult; onOpenCite: OpenCite }) {
  const synth = res.mode === "synthesis";
  if (!res.rows.length) {
    return (
      <div className="tabular text-caos-md text-caos-muted py-1">
        {synth ? "No matching agent syntheses, claims, or QA findings." : "No issuer documents matched."}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 overflow-auto" style={{ maxHeight: 300 }}>
      {res.rows.map((row, i) => (
        <div key={row.issuer.id} className="rounded border border-caos-border/70 bg-caos-bg/40">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-caos-border/50 min-w-0">
            <span className="tabular text-caos-md text-caos-muted shrink-0">{i + 1}</span>
            <span className="text-caos-md text-caos-text truncate min-w-0">{row.issuer.name}</span>
            {row.issuer.ticker ? <span className="tabular text-caos-2xs text-caos-muted">{row.issuer.ticker}</span> : null}
            {row.issuer.industry ? <span className="tabular text-caos-2xs text-caos-muted">· {row.issuer.industry}</span> : null}
            <div className="flex-1" />
            {synth
              ? <Pill text="SYNTHESIS" color="var(--caos-accent)" title="Matched in agent syntheses, claims, and QA findings" />
              : <Pill text="EVIDENCE" color="var(--caos-accent)" title="Matched in the issuer's source documents" />}
          </div>
          <div className="flex flex-col gap-1.5 px-2 py-1.5">
            {row.excerpts.map((ex) => (
              <div key={ex.chunk_id} className="pl-2 border-l-2 border-caos-accent/40">
                <button
                  onClick={() => onOpenCite(ex.chunk_id, ex.doc)}
                  className="tabular text-caos-3xs uppercase tracking-wide text-caos-muted hover:text-caos-accent transition-caos mb-0.5 focus-ring"
                  title="Open source"
                >
                  {ex.doc}
                </button>
                <div className="text-caos-md text-caos-text/90 leading-relaxed">&ldquo;{ex.text}&rdquo;</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The query body (input + ranked/semantic results), reused both as the Command
// Center panel and inside the global Ask launcher (⌘K) modal.
export function NlQueryBody() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<NlQueryResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cite, setCite] = useState<{ id: string; label?: string | null } | null>(null);
  // Polite live-region text so screen-reader users follow the otherwise
  // visual-only query run (busy start → result count / cancelled / failed).
  const [liveMsg, setLiveMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const openCite: OpenCite = (id, label) => setCite({ id, label });

  // A second click while in-flight aborts the request (button reads CANCEL).
  const cancel = () => abortRef.current?.abort();

  const run = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    if (text) setQ(text);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setErr(null);
    setLiveMsg("Querying the metric store…");
    try {
      const result = await nlQuery(question, ctrl.signal);
      setRes(result);
      const n = result.rows.length;
      setLiveMsg(`${n} ${n === 1 ? "issuer" : "issuers"} returned.`);
    } catch (e) {
      if (ctrl.signal.aborted) {
        setRes(null);
        setLiveMsg("Query cancelled.");
        return;
      }
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as Error)?.message || "query failed";
      setErr(String(detail));
      setRes(null);
      setLiveMsg("Query failed.");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
        {/* input */}
        <div className="flex items-center gap-2">
          <span className="text-caos-accent text-caos-2xl">✦</span>
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
            placeholder="Ask across issuers — e.g. which margins are most exposed to energy-price inflation"
            aria-label="Ask a question across issuers"
            maxLength={500}
            className="flex-1 px-2.5 py-1.5 text-caos-xl"
          />
          <button
            onClick={() => (busy ? cancel() : run())}
            disabled={!busy && !q.trim()}
            aria-label={busy ? "Cancel query" : "Ask across issuers"}
            className="shrink-0 tabular text-caos-md px-3 py-1.5 rounded transition-caos disabled:opacity-40"
            style={
              busy
                ? { background: "transparent", color: "var(--caos-muted)", boxShadow: "inset 0 0 0 1px var(--caos-border)" }
                : { background: "var(--caos-accent)", color: "var(--caos-bg)" }
            }
          >
            {busy ? "CANCEL" : "ASK"}
          </button>
        </div>

        {/* polite live region — announces run start, result count, cancel, or failure */}
        <div className="sr-only" role="status" aria-live="polite">{liveMsg}</div>

        {/* in-flight affordance — a visible, labelled busy row (not a bare "…") */}
        {busy ? (
          <div className="flex items-center gap-1.5 tabular text-caos-xs text-caos-muted">
            <StatusGlyph kind="running" className="caos-running" />
            querying the metric store…
          </div>
        ) : null}

        {/* starters (only before a result) */}
        {!res && !busy ? (
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => run(s)}
                className="tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {err ? (
          <div role="alert" className="tabular text-caos-md px-2 py-1.5 rounded border" style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 50%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}>
            <StatusGlyph kind="warning" /> {err}
          </div>
        ) : null}

        {res ? (
          <div className="flex flex-col gap-2">
            {/* interpretation — show the analyst exactly how the question was read */}
            <div className="tabular text-caos-md text-caos-muted leading-snug">
              <span className="uppercase tracking-wider text-caos-2xs text-caos-accent mr-1.5">Reading</span>
              {res.interpretation}
            </div>

            {/* auto-generated narrative — the so-what, always shown */}
            {(() => {
              const summary = narrate(res);
              return summary ? (
                <div className="text-caos-md text-caos-text/90 leading-snug">
                  <span className="uppercase tracking-wider text-caos-2xs text-caos-accent mr-1.5">Summary</span>
                  {summary}
                </div>
              ) : null;
            })()}

            {/* auto-selected visualization — bar chart for rankable multi-row results */}
            {(() => {
              const spec = barSpecFor(res);
              if (!spec) return null;
              const h = Math.max(150, Math.min(280, (spec.data as unknown[]).length * 34 + 56));
              return (
                <div className="rounded border border-caos-border/60 bg-caos-bg/30 p-1.5">
                  <G2Chart spec={spec} height={h} />
                </div>
              );
            })()}

            {res.mode === "semantic" || res.mode === "synthesis"
              ? <SemanticView res={res} onOpenCite={openCite} />
              : <StructuredView res={res} onOpenCite={openCite} />}

            {/* caveats — honesty about seed vs run-derived / qualitative match */}
            {res.caveats.length ? (
              <div className="tabular text-caos-xs text-caos-muted leading-snug">
                {res.caveats.map((c, i) => <div key={i}>· {c}</div>)}
              </div>
            ) : null}
          </div>
        ) : null}

        {cite ? <CitationViewer chunkId={cite.id} label={cite.label} onClose={() => setCite(null)} /> : null}
    </div>
  );
}

export function NlQuery() {
  return (
    <PanelShell
      title="Ask across issuers · cross-issuer query"
      className="shrink-0"
      right={<span className="tabular text-caos-xs text-caos-muted">grounded in the metric store · cited where run-derived</span>}
    >
      <div className="p-2.5"><NlQueryBody /></div>
    </PanelShell>
  );
}
