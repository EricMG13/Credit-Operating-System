"use client";

// The right-hand Report panel of Concept G — Deep Research. Split from the page
// so the brief form stays a flat component: this owns the four mutually
// exclusive report states (running progress · error · finished tear-sheet ·
// empty manifest), each one branch of a single dispatch.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Panel } from "@/components/shared/Panel";
import { labelCls } from "@/components/shared/styles";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { AuthorityBlock } from "@/components/shared/AuthorityBlock";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { Button } from "@/components/ui/Button";
import { SemanticVisualization, type VisualizationDatum, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { fromResearchResult } from "@/lib/provenance";
import type { ResearchFigure, ResearchResult, ResearchProgress } from "@/lib/api";

// react-markdown + remark-gfm (~40 kB) only render once a run resolves, so they
// load on demand rather than weighing down the brief form's initial chunk.
const ReportBody = dynamic(() => import("./ReportBody"), { ssr: false });

// Staged status for the multi-minute run — a coarse, honest phase label derived
// from elapsed time (there is no server-side phase to stream). The substance of
// the running view is the REAL counters + criteria below, not this hint.
const RESEARCH_PHASES = [
  "Searching sources",
  "Reading filings & rating actions",
  "Cross-checking figures",
  "Synthesizing the credit view",
];
const RESEARCH_PHASE_SECS = 25;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// The four deliverable sections, mirrored in the empty-state manifest so the
// page previews its own output (the report's actual H2s).
const DELIVERABLE: [string, string][] = [
  ["Executive summary", "bottom-line credit conclusion"],
  ["Detailed findings", "by investigation criterion"],
  ["Summary tables", "leverage, ratings, valuation"],
  ["Recommendations", "strategic actions · cited sources"],
];

// Filing date for the tear-sheet masthead — client-only (report renders post-run),
// so no static-export hydration mismatch. Deliberately NOT lib/format-date: the
// paper register uses its own print format ("15 JUL 2026"), distinct from the
// workspace UTC desk stamps.
const fileDate = () =>
  new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

const _reduceMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Ease a displayed integer up to `target` so real counts read as *accumulating*
// between the sparse (per-turn) poll updates. Only ever eases toward the real
// value — it never shows more than the server has actually reported. Honors
// prefers-reduced-motion by snapping.
function useCountUp(target: number, ms = 700): number {
  const [n, setN] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (from.current === target || _reduceMotion()) {
      from.current = target;
      setN(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3); // ease-out cubic
      const val = Math.round(start + (target - start) * eased);
      setN(val);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

// A single real running metric (sources / searches). Number is mono tabular —
// correct here, it's a figure, not prose.
function Counter({ n, label }: { n: number; label: string }) {
  const shown = useCountUp(n);
  return (
    <div className="border border-caos-border rounded px-3 py-2 bg-caos-panel/40">
      <div className="tabular tabular-nums text-[22px] text-caos-text leading-none">{shown}</div>
      <div className={labelCls + " mt-1"}>{label}</div>
    </div>
  );
}

function RunningView({
  elapsed,
  subj,
  progress,
  criteria,
  executionMode,
  onDetach,
}: {
  elapsed: number;
  subj: string;
  progress: ResearchProgress | null;
  criteria: string[];
  executionMode: "live" | "demo";
  onDetach?: () => void;
}) {
  const phase = RESEARCH_PHASES[Math.min(Math.floor(elapsed / RESEARCH_PHASE_SECS), RESEARCH_PHASES.length - 1)];
  const sources = progress?.sources ?? 0;
  const searches = progress?.searches ?? 0;
  return (
    <div className="h-full overflow-auto px-6 py-8">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex items-baseline justify-between border-b border-caos-border pb-2 mb-4">
          <span className={labelCls}>Researching</span>
          <span className="tabular text-caos-2xs text-caos-muted">{mmss(elapsed)}</span>
        </div>
        <div className="tabular text-caos-xl text-caos-text mb-1 truncate" title={subj || undefined}>
          {subj ? `“${subj}”` : "Reattached run"}
        </div>
        <p className="text-caos-2xs text-caos-muted leading-snug mb-5">{phase} · {executionMode === "live" ? "live web research" : "example research — demo mode"}</p>

        {/* Real running counts — the server's actual web-search progress, eased up
            so it reads as accumulating. Never a fabricated number. */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <Counter n={sources} label={sources === 1 ? "source" : "sources"} />
          <Counter n={searches} label={searches === 1 ? "search" : "searches"} />
        </div>

        {/* Claims being checked — the brief's own investigation criteria, each
            live. We never mark one "done" (no per-criterion signal to honor). */}
        <div className={labelCls + " mb-2"}>Checking against your criteria</div>
        {criteria.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full caos-running shrink-0" style={{ background: "var(--caos-accent)" }} />
                <span className="text-caos-sm text-caos-muted leading-snug">{c}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-caos-sm text-caos-muted leading-snug">Working through the standard credit criteria.</p>
        )}
        <div className="mt-6 pt-4 border-t border-caos-border flex items-baseline justify-between gap-3">
          <p className="text-caos-2xs text-caos-muted leading-snug">
            Typically 2–4 minutes. The run continues even if you leave —
            reload to reattach.
          </p>
          {onDetach && (
            <button
              type="button"
              onClick={onDetach}
              className="tabular text-caos-2xs uppercase tracking-wider px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-muted transition-caos focus-ring shrink-0"
              title="Stop watching in this tab — the run keeps going server-side"
            >
              Detach
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorView({ error, hasPrev, onRestorePrev }: { error: string; hasPrev: boolean; onRestorePrev?: () => void }) {
  return (
    <div className="caos-enter h-full overflow-auto px-6 py-8">
      <SurfaceState
        kind="error"
        title="Research failed"
        detail={`${error} Adjust the brief and run again.`}
        className="w-full max-w-sm mx-auto"
        primaryAction={hasPrev && onRestorePrev ? <button type="button" onClick={onRestorePrev} className="caos-action-primary focus-ring">View previous report</button> : undefined}
      />
    </div>
  );
}

function researchFigureSpec(figure: ResearchFigure): VisualizationSpec<VisualizationDatum> {
  const data = figure.rows as VisualizationDatum[];
  const x = figure.encodings.x ?? figure.columns[0]?.key ?? "label";
  const y = figure.encodings.y ?? figure.columns[1]?.key ?? "value";
  const series = figure.encodings.series;
  return {
    kind: figure.kind,
    title: figure.title,
    unit: figure.unit,
    asOf: figure.as_of ?? undefined,
    sourceIds: figure.source_ids,
    accessibleSummary: figure.accessible_summary,
    note: "Verified CAOS metric facts; separate from the AI-synthesized research narrative.",
    data,
    tabularFallback: { label: `${figure.title} verified data`, columns: figure.columns, data },
    chart: figure.kind === "line"
      ? { type: "line", encode: { x, y, ...(series ? { color: series } : {}) } }
      : { type: "interval", encode: { x, y } },
  };
}

function ResearchFigures({ figures }: { figures: ResearchFigure[] }) {
  if (!figures.length) return null;
  return (
    <section className="rdoc-figures" aria-label="Verified CAOS figures">
      <div className="rdoc-figures-h">Verified CAOS figures</div>
      {figures.map((figure) => (
        <SemanticVisualization
          key={figure.id}
          spec={researchFigureSpec(figure)}
          height={190}
          mode="paper"
          headingLevel={2}
        />
      ))}
    </section>
  );
}

// The tear-sheet document itself — shared by the on-screen panel and the
// body-level print portal so screen and exported paper carry identical
// provenance (matrix 8.2: the AI-synthesis marker must survive export).
function ResearchDoc({ result, mode }: { result: ResearchResult; mode: "sector" | "issuer" }) {
  return (
    <article className="research-doc">
      <header className="rdoc-mast">
        <span className="rdoc-brand"><span className="rdoc-mark">C</span>Deep Credit Research</span>
        <span className="rdoc-meta">{mode === "sector" ? "Sector" : "Issuer"} · {fileDate()}</span>
      </header>
      {/* Printed authority block — the same structured Origin/Method/Freshness
          grammar Report Studio's IC memo carries, so an exported research
          tear-sheet states its own evidence basis on its face (G2). */}
      <AuthorityBlock prov={fromResearchResult(result)} />
      {/* On-sheet integrity notice — an amputated narrative must announce itself on
          the paper, not just in the app chrome, so it survives PDF export and a
          reader can't mistake it for a finished committee document (H1). */}
      {result.truncated && (
        <p className="rdoc-truncated" role="alert">
          <strong>Incomplete</strong> — narrative truncated by the output limit;
          later sections may be missing. Re-run or raise the AI mode before relying on this.
        </p>
      )}
      <ReportBody report={result.report} />
      <ResearchFigures figures={result.figures ?? []} />
      {result.sources.length > 0 && (
        <section className="rdoc-sources">
          <div className="rdoc-sources-h">Sources ({result.sources.length})</div>
          <ol>
            {result.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
              </li>
            ))}
          </ol>
        </section>
      )}
      <footer className="rdoc-foot">
        {/* House provenance line (mirrors ReportDoc's rd-foot) — the exported
            PDF must say on its face that the analysis is AI-synthesized. */}
        <span>Generated by CREDIT OS · DEEP RESEARCH</span>
        {/* Demo reports carry no structured citations; say "illustrative"
            rather than the misleading "0 sources". Live narrative is LLM-
            synthesized — say so, and tell the reader to verify. */}
        <span>{result.demo ? "Illustrative · demo" : `AI-synthesized · ${result.sources.length} ${result.sources.length === 1 ? "source" : "sources"} — verify against cited sources`}{result.truncated ? " · TRUNCATED" : ""}</span>
      </footer>
    </article>
  );
}

function ResultView({ result, mode }: { result: ResearchResult; mode: "sector" | "issuer" }) {
  // On-screen tear-sheet only. The body-level print copy (EXPORT PDF) is mounted
  // separately by ResearchPrintPortal — one .print-root, cleaned up on unmount.
  return (
    <div className="research-paper-shell caos-enter">
      <ResearchDoc result={result} mode={mode} />
    </div>
  );
}

// EXPORT PDF is window.print(), and the global print rule hides every body
// child except a body-level `.print-root` (globals.css) — without one, /research
// printed blank pages. Portal a print-only copy of the doc to <body>, same
// pattern as Report Studio (app/reports/page.tsx) and the Query exhibit.
function ResearchPrintPortal({ result, mode }: { result: ResearchResult; mode: "sector" | "issuer" }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const d = document.createElement("div");
    d.className = "print-root";
    document.body.appendChild(d);
    setEl(d);
    return () => { document.body.removeChild(d); };
  }, []);
  if (!el) return null;
  return createPortal(<ResearchDoc result={result} mode={mode} />, el);
}

function EmptyView() {
  return (
    <div className="h-full overflow-auto px-6 py-8">
      <div className="w-full max-w-sm mx-auto">
        <SurfaceState
          kind="not-run"
          title="Research not run"
          detail="Complete the brief and run research. The finished deliverable files here as a paper tear-sheet."
          supporting={
            <div>
              <div className={labelCls + " mb-1"}>Expected deliverable</div>
              <ol className="flex flex-col">
                {DELIVERABLE.map(([h, d], i) => (
                  <li key={h} className="list-none flex items-baseline gap-3 py-2 border-b border-caos-border/50 last:border-0">
                    <span className="tabular text-caos-2xs text-caos-muted w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="tabular text-caos-sm text-caos-text shrink-0">{h}</span>
                    <span className="text-caos-2xs text-caos-muted flex-1 min-w-0 text-right truncate">{d}</span>
                  </li>
                ))}
              </ol>
            </div>
          }
        />
      </div>
    </div>
  );
}

// Pure presentational dispatch over the four mutually exclusive report states;
// the branch count is the component's entire purpose.
// fallow-ignore-next-line complexity
export function ReportPane({
  running,
  error,
  result,
  prevResult,
  progress,
  criteria,
  elapsed,
  subj,
  mode,
  executionMode = "live",
  onDetach,
  onRestorePrev,
}: {
  running: boolean;
  error: string | null;
  result: ResearchResult | null;
  prevResult?: ResearchResult | null;
  progress: ResearchProgress | null;
  criteria: string[];
  elapsed: number;
  subj: string;
  mode: "sector" | "issuer";
  executionMode?: "live" | "demo";
  onDetach?: () => void;
  onRestorePrev?: () => void;
}) {
  const badge = (
    <span className="flex items-center gap-2">
      {/* One provenance grammar (lib/provenance.ts) — replaces the old bespoke
          DEMO / ●LIVE / "AI-synthesized" chip cluster with the same
          Origin/Freshness/Method vocabulary every other surface uses. */}
      {result ? <ProvenanceChip prov={fromResearchResult(result)} /> : null}
      {/* Truncation is an integrity signal, not decoration — a report cut off at
          the output limit must never file as complete (H1). Glyph + word carry it,
          not hue alone (a11y: status never by color only). */}
      {result?.truncated ? (
        <span
          className="tabular text-caos-3xs uppercase tracking-wider px-1.5 py-px rounded border"
          style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 55%, transparent)", backgroundColor: "color-mix(in srgb, var(--caos-warning) 12%, transparent)" }}
          title="Narrative truncated by the output limit — re-run or raise AI mode"
        >
          ⚠ Truncated
        </span>
      ) : null}
      {result ? (
        <Button
          onClick={() => window.print()}
          className="tabular text-caos-xs px-2 py-0.5"
        >
          EXPORT PDF
        </Button>
      ) : null}
    </span>
  );

  return (
    <Panel title="Report" right={badge}>
      <div className="h-full overflow-auto">
        {running ? (
          <RunningView elapsed={elapsed} subj={subj} progress={progress} criteria={criteria} executionMode={executionMode} onDetach={onDetach} />
        ) : error ? (
          <ErrorView error={error} hasPrev={!!prevResult} onRestorePrev={onRestorePrev} />
        ) : result ? (
          <>
            <ResultView result={result} mode={mode} />
            <ResearchPrintPortal result={result} mode={mode} />
          </>
        ) : (
          <EmptyView />
        )}
      </div>
    </Panel>
  );
}
