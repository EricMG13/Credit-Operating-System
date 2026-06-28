"use client";

// The right-hand Report panel of Concept G — Deep Research. Split from the page
// so the brief form stays a flat component: this owns the four mutually
// exclusive report states (running progress · error · finished tear-sheet ·
// empty manifest), each one branch of a single dispatch.

import dynamic from "next/dynamic";
import { Panel } from "@/components/shared/Panel";
import { labelCls } from "@/components/shared/styles";
import type { ResearchResult } from "@/lib/api";

// react-markdown + remark-gfm (~40 kB) only render once a run resolves, so they
// load on demand rather than weighing down the brief form's initial chunk.
const ReportBody = dynamic(() => import("./ReportBody"), { ssr: false });

// Staged status for the multi-minute run — there is no server-side progress to
// stream, so cycle honest phase copy off elapsed time to keep the wait legible.
// Paced (~25s/phase) so the long tail honestly rests on "Synthesizing" — the
// genuinely slow step — rather than parking on a "finalizing" lie.
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
// so no static-export hydration mismatch.
const fileDate = () =>
  new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

// Phase status reads by glyph shape AND opacity, never color alone: done = ✓,
// active = pulsing filled dot, pending = hollow ring.
function PhaseDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span aria-hidden className="w-3 flex items-center justify-center shrink-0">
      {done ? (
        <span className="text-caos-sm leading-none" style={{ color: "var(--caos-success)" }}>✓</span>
      ) : active ? (
        <span className="h-1.5 w-1.5 rounded-full caos-running" style={{ background: "var(--caos-accent)" }} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full border" style={{ borderColor: "var(--caos-idle)" }} />
      )}
    </span>
  );
}

function RunningView({ elapsed, subj }: { elapsed: number; subj: string }) {
  const phaseIdx = Math.min(Math.floor(elapsed / RESEARCH_PHASE_SECS), RESEARCH_PHASES.length - 1);
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="flex items-baseline justify-between border-b border-caos-border pb-2 mb-4">
          <span className={labelCls}>Researching</span>
          <span className="tabular text-caos-2xs text-caos-muted">{mmss(elapsed)}</span>
        </div>
        <div className="tabular text-caos-md text-caos-text mb-4 truncate" title={subj}>
          “{subj}”
        </div>
        {/* Honest staged progress: phases advance off elapsed time (no
            server-side stream). */}
        <ol className="flex flex-col gap-2.5">
          {RESEARCH_PHASES.map((p, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            return (
              <li key={p} className="flex items-center gap-2.5">
                <PhaseDot done={done} active={active} />
                <span className={"tabular text-caos-sm " + (active ? "text-caos-text" : done ? "text-caos-muted" : "text-caos-muted opacity-45")}>
                  {p}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="tabular text-caos-2xs text-caos-muted leading-snug mt-4">
          Live web research · typically 2–4 minutes.
        </p>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: string }) {
  return (
    <div role="alert" className="caos-enter h-full flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="border-b pb-2 mb-4" style={{ borderColor: "var(--caos-critical)" }}>
          <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: "var(--caos-critical-bright)" }}>Research failed</span>
        </div>
        <p className="tabular text-caos-sm text-caos-text leading-snug">{error}</p>
        <p className="tabular text-caos-2xs text-caos-muted leading-snug mt-3">Adjust the brief and run again.</p>
      </div>
    </div>
  );
}

function ResultView({ result, mode }: { result: ResearchResult; mode: "sector" | "issuer" }) {
  return (
    <div className="research-paper-shell">
      <article className="research-doc caos-enter">
        <header className="rdoc-mast">
          <span className="rdoc-brand"><span className="rdoc-mark">C</span>Deep Credit Research</span>
          <span className="rdoc-meta">{mode === "sector" ? "Sector" : "Issuer"} · {fileDate()}</span>
        </header>
        <ReportBody report={result.report} />
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
          <span>CAOS · Credit Agent OS</span>
          <span>{result.sources.length} {result.sources.length === 1 ? "source" : "sources"}</span>
        </footer>
      </article>
    </div>
  );
}

function EmptyView() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline justify-between border-b border-caos-border pb-2 mb-4">
          <span className="tabular text-caos-xl text-caos-text">No report yet</span>
          <span className="tabular text-caos-2xs text-caos-muted">DRAFT</span>
        </div>
        <p className="tabular text-caos-sm text-caos-muted leading-snug mb-5">
          Fill the brief, then run. The finished report files here as a paper tear-sheet.
        </p>
        <div className={labelCls + " mb-1"}>The deliverable</div>
        <ol className="flex flex-col">
          {DELIVERABLE.map(([h, d], i) => (
            <li key={h} className="list-none flex items-baseline gap-3 py-2 border-b border-caos-border/50 last:border-0">
              <span className="tabular text-caos-2xs text-caos-muted w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="tabular text-caos-sm text-caos-text shrink-0">{h}</span>
              <span className="tabular text-caos-2xs text-caos-muted flex-1 min-w-0 text-right truncate">{d}</span>
            </li>
          ))}
        </ol>
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
  elapsed,
  subj,
  mode,
}: {
  running: boolean;
  error: string | null;
  result: ResearchResult | null;
  elapsed: number;
  subj: string;
  mode: "sector" | "issuer";
}) {
  const badge = (
    <span className="flex items-center gap-2">
      {result?.demo ? (
        <span className="tabular text-caos-xs" style={{ color: "var(--caos-warning)" }}>DEMO</span>
      ) : result ? (
        <span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>● LIVE</span>
      ) : null}
      {result ? (
        <button
          onClick={() => window.print()}
          className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
        >
          EXPORT PDF
        </button>
      ) : null}
    </span>
  );

  return (
    <Panel title="Report" right={badge}>
      <div className="h-full overflow-auto">
        {running ? (
          <RunningView elapsed={elapsed} subj={subj} />
        ) : error ? (
          <ErrorView error={error} />
        ) : result ? (
          <ResultView result={result} mode={mode} />
        ) : (
          <EmptyView />
        )}
      </div>
    </Panel>
  );
}
