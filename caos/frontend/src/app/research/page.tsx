"use client";

// Concept G — Deep Research: autonomous, multi-source web research through a
// credit-analyst lens (mimics Gemini Deep Research). The analyst fills a
// structured brief (left); Claude runs the web_search server tool and returns a
// committee-ready Markdown credit report (right). Without a model key the server
// returns a canned demo report, so the concept stays demoable offline.

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { ScopeToggle } from "@/components/shared/ScopeToggle";
import { AiModeToggle } from "@/components/shared/AiModeToggle";
import { labelCls } from "@/components/shared/styles";
import { Panel } from "@/components/shared/Panel";
import { TextInput, INPUT_BASE } from "@/components/shared/TextInput";
import { ReportPane } from "@/components/research/ReportPane";
import { useNotify } from "@/components/shared/Notifications";
import { deepResearch, getSettings, type ResearchBrief, type ResearchResult, type ResearchProgress } from "@/lib/api";
import { DEFAULT_CRITERIA, loadPrefs, type AiMode } from "@/lib/research-prefs";

export default function ResearchPage() {
  return (
    <RequireAuth>
      <Research />
    </RequireAuth>
  );
}

// Whether the "Advanced brief" section is expanded — browser-local so a power
// user who opens it once keeps it open, while a first run stays Scope + Subject
// + Run (the whole job, nothing else in the way).
const _ADV_KEY = "caos.research.adv";

// Dense analyst page (the brief form drives the report pane); same structural
// shape as ModelBuilder/ReportStudio. The report states already live in
// ReportPane — splitting the form further would prop-drill 13 state fields.
// fallow-ignore-next-line complexity
function Research() {
  const [mode, setMode] = useState<"sector" | "issuer">("sector");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("");
  const [decision, setDecision] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [focus, setFocus] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [aiMode, setAiMode] = useState<AiMode>("standard");
  const [adv, setAdv] = useState(false); // advanced-brief disclosure (persisted post-mount)

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const notify = useNotify();

  // Seed the brief from the analyst's saved Settings defaults (post-mount, so
  // static-export hydration isn't mismatched). Only touches the standing-lens
  // fields — subject/focus/exclusions stay per-run — plus the disclosure state.
  useEffect(() => {
    const p = loadPrefs();
    setMode(p.mode);
    setAudience(p.audience);
    setDecision(p.decision);
    setTimeframe(p.timeframe);
    setCriteria(p.criteria);
    setAiMode(p.ai_mode);
    try {
      setAdv(localStorage.getItem(_ADV_KEY) === "1");
    } catch {
      /* private mode — disclosure just starts collapsed */
    }
  }, []);

  // Demo-vs-live gate: warn before a run is spent (best-effort — a failed
  // settings fetch just leaves the state unknown, no banner).
  useEffect(() => {
    getSettings().then((s) => setLlmConfigured(s.llm_configured)).catch(() => {});
  }, []);

  // Elapsed timer while a run is in flight; the phase copy derives from it.
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Derived once per render and reused across the form + report pane.
  const subj = subject.trim();
  const canRun = subj.length >= 2;
  const criteriaList = criteria.split("\n").map((c) => c.trim()).filter(Boolean);

  const toggleAdv = () =>
    setAdv((v) => {
      const next = !v;
      try {
        localStorage.setItem(_ADV_KEY, next ? "1" : "0");
      } catch {
        /* private mode — open state just doesn't persist */
      }
      return next;
    });

  // Cyclomatic is inflated by defensive optional-chaining in the error path;
  // cognitive complexity is 4 — the flow is linear.
  // fallow-ignore-next-line complexity
  async function run() {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    const opt = (s: string) => s.trim() || undefined; // drop blank optional fields
    const brief: ResearchBrief = {
      subject: subj,
      mode,
      ai_mode: aiMode,
      audience: opt(audience),
      decision: opt(decision),
      timeframe: opt(timeframe),
      focus: opt(focus),
      exclusions: opt(exclusions),
      criteria: criteriaList,
    };
    try {
      const done = await deepResearch(brief, setProgress); // setProgress ← live counts each poll
      setResult(done);
      notify("Research complete", `${mode === "sector" ? "Sector" : "Issuer"} · ${brief.subject}`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Research failed — try again.";
      setError(msg);
      notify("Research failed", msg);
    } finally {
      setRunning(false);
    }
  }

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    big = false, // the primary subject input — reads as the page's focal title entry
  ) => (
    <label className="flex flex-col gap-1">
      <span className={big ? "tabular text-caos-2xs uppercase tracking-wider text-caos-text" : labelCls}>{label}</span>
      <TextInput
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className={"w-full px-2 " + (big ? "py-2.5 text-[16px] leading-tight" : "py-1.5 text-caos-md")}
      />
    </label>
  );

  const area = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    rows = 2,
  ) => (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={INPUT_BASE + " w-full px-2 py-1.5 text-caos-md leading-snug resize-y"}
      />
    </label>
  );

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <PageSubHeader>
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Deep Research — sector &amp; issuer credit intelligence</span>
      </PageSubHeader>

      {/* workspace — brief (left) drives the report (right) */}
      <div className="flex-1 min-h-0 grid grid-cols-[400px_minmax(0,1fr)] gap-2 p-2">
        <Panel title="Research brief">
          {/* min-h-full (not h-full): fills the panel when short, and grows so the
              panel's own overflow-auto scrolls when the advanced section is open —
              no flex-1 child to collapse and overlap on a short viewport. */}
          <div className="min-h-full p-3 flex flex-col gap-4">
            {llmConfigured === false && (
              <div
                className="flex items-baseline gap-2 px-2.5 py-2 rounded border"
                style={{ borderColor: "var(--caos-warning)", background: "color-mix(in srgb, var(--caos-warning) 6%, transparent)" }}
              >
                <span className="tabular text-caos-2xs uppercase tracking-wider shrink-0" style={{ color: "var(--caos-warning)" }}>Demo mode</span>
                <span className="text-caos-xs text-caos-muted leading-snug">No model key configured — runs return a canned example report.</span>
              </div>
            )}

            {/* Essentials — the whole job: pick a grain, name the subject. */}
            <div className="flex flex-col gap-3">
              <ScopeToggle value={mode} onChange={setMode} label="Scope" ariaLabel="Research scope" />
              {field(
                mode === "sector" ? "Sector / theme" : "Issuer",
                subject,
                setSubject,
                mode === "sector" ? "e.g. North American & European enterprise software" : "e.g. Atlas Forge",
                true,
              )}
            </div>

            {/* Advanced brief — framing, boundaries, criteria, power preset. One
                click away; collapsed by default so a first run isn't nine fields. */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={toggleAdv}
                aria-expanded={adv}
                className="self-start flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded text-caos-muted hover:text-caos-text transition-caos focus-ring"
              >
                <svg viewBox="0 0 16 16" aria-hidden className={"w-3 h-3 stroke-current transition-transform " + (adv ? "rotate-90" : "")} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 4 4 4-4 4" />
                </svg>
                <span className={labelCls}>Advanced brief</span>
              </button>
              {adv && (
                <div className="flex flex-col gap-4 caos-enter">
                  <div className="flex flex-col gap-3">
                    {field("Audience", audience, setAudience, "the credit investment committee")}
                    {field("Decision to inform", decision, setDecision, "position sizing and credit selection")}
                    {field("Timeframe", timeframe, setTimeframe, "the last 12 months to present")}
                  </div>
                  <div className="flex flex-col gap-3">
                    {area("Focus areas (optional)", focus, setFocus, "geographies, sub-segments, capital-structure tiers…")}
                    {area("Exclusions (optional)", exclusions, setExclusions, "topics to avoid…")}
                    {area("Investigation criteria — one per line", criteria, setCriteria, "", 7)}
                  </div>
                  <AiModeToggle value={aiMode} onChange={setAiMode} />
                </div>
              )}
            </div>

            {/* Action — the primary move: a solid, confident button, anchored to
                the panel foot (mt-auto) so it never floats mid-form. */}
            <div className="flex flex-col gap-2 mt-auto pt-1">
              <button
                type="button"
                onClick={run}
                disabled={!canRun || running}
                className={
                  "text-caos-md font-semibold px-3 py-2.5 rounded border transition-caos focus-ring " +
                  (running
                    ? "bg-caos-elevated border-caos-border text-caos-muted cursor-wait"
                    : !canRun
                      ? "bg-caos-elevated border-caos-border text-caos-muted cursor-not-allowed"
                      : "bg-caos-accent border-caos-accent text-caos-bg hover:brightness-110")
                }
              >
                {running
                  ? "Researching…"
                  : llmConfigured === false
                    ? "Run example research"
                    : "Run deep research"}
              </button>
              {!canRun && (
                <p className="text-caos-2xs text-caos-muted leading-snug">
                  Enter a {mode === "sector" ? "sector" : "issuer"} above to run.
                </p>
              )}
            </div>
          </div>
        </Panel>

        <ReportPane
          running={running}
          error={error}
          result={result}
          progress={progress}
          criteria={criteriaList}
          elapsed={elapsed}
          subj={subj}
          mode={mode}
        />
      </div>
    </div>
  );
}
