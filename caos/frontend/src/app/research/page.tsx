"use client";

// Concept G — Deep Research: autonomous, multi-source web research through a
// credit-analyst lens (mimics Gemini Deep Research). The analyst fills a
// structured brief (left); Claude runs the web_search server tool and returns a
// committee-ready Markdown credit report (right). Without a model key the server
// returns a canned demo report, so the concept stays demoable offline.

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { useAuth } from "@/components/shared/AuthProvider";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ScopeToggle } from "@/components/shared/ScopeToggle";
import { ActionReason } from "@/components/shared/ActionReason";
import { AiModeToggle } from "@/components/shared/AiModeToggle";
import { labelCls } from "@/components/shared/styles";
import { Panel } from "@/components/shared/Panel";
import { TextInput, INPUT_BASE } from "@/components/shared/TextInput";
import { ReportPane } from "@/components/research/ReportPane";
import { useNotify } from "@/components/shared/Notifications";
import { deepResearch, resumeResearch, getResearchStatus, isResearchAborted, isResearchGone, getSettings, toErrorMessage, type ResearchBrief, type ResearchResult, type ResearchProgress } from "@/lib/api";
import { DEFAULT_CRITERIA, loadPrefs, type AiMode } from "@/lib/research-prefs";
import Link from "next/link";
import { analysisApi, contextHref, useAnalysisContext } from "@/lib/analysis-workbench";

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

// The in-flight durable job id, kept in sessionStorage keyed per analyst so a
// reload / mid-run navigation can reattach to the same server-side run instead of
// orphaning it (H3). sessionStorage (not local) scopes it to this tab; keying by
// analyst id keeps a shared machine from cross-attaching another analyst's run —
// the GET is owner-scoped and 404s a foreign id anyway, but this avoids the round-
// trip. Value = the job id; absence = nothing in flight.
const _jobKey = (analystId: string, contextId?: string) => `caos.research.job.${analystId}.${contextId ?? "unscoped"}`;
const _loadJobId = (analystId: string, contextId?: string): string | null => {
  try {
    return sessionStorage.getItem(_jobKey(analystId, contextId))
      || sessionStorage.getItem(`caos.research.job.${analystId}`)
      || null;
  } catch {
    return null; // private mode — resume just isn't available
  }
};
const _storeJobId = (analystId: string, contextId: string | undefined, id: string | null): void => {
  try {
    if (id) sessionStorage.setItem(_jobKey(analystId, contextId), id);
    else sessionStorage.removeItem(_jobKey(analystId, contextId));
    sessionStorage.removeItem(`caos.research.job.${analystId}`);
  } catch {
    /* private mode — reattach just won't survive a reload */
  }
};

// Dense analyst page (the brief form drives the report pane); same structural
// shape as ModelBuilder/ReportStudio. The report states already live in
// ReportPane — splitting the form further would prop-drill 13 state fields.
// fallow-ignore-next-line complexity
function Research() {
  const analysis = useAnalysisContext({ name: "Deep research" });
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
  const [prevResult, setPrevResult] = useState<ResearchResult | null>(null); // retained across a rerun (H5)
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [configState, setConfigState] = useState<"loading" | "live" | "demo" | "error">("loading");
  const [reattachError, setReattachError] = useState<string | null>(null);
  const [reattachRetry, setReattachRetry] = useState(0);
  const notify = useNotify();
  const { user } = useAuth();
  const analystId = user?.id ?? "";

  // Abort handle for the active poll loop — aborted on unmount (so a closed/renav'd
  // tab stops polling for up to 15 min) and on Detach. Aborting only stops the
  // client watching; the durable server-side job keeps running (H3).
  const pollAbort = useRef<AbortController | null>(null);
  const activeJobId = useRef<string | null>(null);
  const restoredContext = useRef<string | null>(null);

  useEffect(() => {
    const context = analysis.context;
    if (!context || restoredContext.current === context.id) return;
    restoredContext.current = context.id;
    const saved = context.surface_state.research;
    if (saved?.query) setSubject(saved.query);
    if (saved?.view === "issuer" || saved?.view === "sector") setMode(saved.view);
  }, [analysis.context]);

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

  const loadResearchConfiguration = useCallback(async () => {
    setConfigState("loading");
    try {
      const loaded = await getSettings();
      setConfigState(loaded.llm_configured ? "live" : "demo");
    } catch {
      setConfigState("error");
    }
  }, []);

  // A run cannot be labelled live/demo until the server confirms its mode.
  useEffect(() => { void loadResearchConfiguration(); }, [loadResearchConfiguration]);

  // Elapsed timer while a run is in flight; the phase copy derives from it.
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Reattach on mount: if this analyst has a durable job id from a prior page life
  // (reload / mid-run navigation, or a completed report the analyst stepped away
  // from), route on its current terminal state instead of orphaning it (H3). A one
  // GET probe decides:
  //   • complete → hydrate the finished report straight into ResultView, no
  //     "Researching…" flash — a 2–4-minute, real-spend report survives a reload
  //     or a cross-check hop to Deep-Dive rather than being forfeited;
  //   • running  → resume polling into RunningView via watch(), as before;
  //   • gone/failed → drop the stale id quietly (never a scary "Research failed").
  // Runs once per analyst.
  useEffect(() => {
    const contextId = analysis.context?.id;
    if (!analystId || !contextId) return;
    const stored = _loadJobId(analystId, contextId);
    if (!stored) return;
    activeJobId.current = stored;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const probe = async () => {
      attempt += 1;
      try {
        const st = await getResearchStatus(stored);
        if (cancelled) return;
        setReattachError(null);
        if (st.state === "complete") {
          setResult(st.result);
          return;
        }
        if (st.state === "running") {
          const ctrl = new AbortController();
          void watch(resumeResearch(stored, setProgress, ctrl.signal), ctrl);
          return;
        }
        // A typed gone/failed terminal is authoritative; transport failures are not.
        _storeJobId(analystId, contextId, null);
        activeJobId.current = null;
      } catch (err) {
        if (cancelled) return;
        if (isResearchGone(err)) {
          _storeJobId(analystId, contextId, null);
          activeJobId.current = null;
          setReattachError(null);
          return;
        }
        setReattachError(toErrorMessage(err, "Could not reattach to the saved research job"));
        if (attempt < 3) {
          retryTimer = setTimeout(() => { void probe(); }, attempt * 1000);
        }
      }
    };
    void probe();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // watch() is intentionally captured from the current analyst/context render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analystId, analysis.context?.id, reattachRetry]);

  // Abort the active poll on unmount so a closed / navigated-away tab stops
  // polling (previously it kept GETting for up to 15 min). The durable job is
  // untouched — its id is still in sessionStorage for the next mount to reattach.
  useEffect(() => () => pollAbort.current?.abort(), []);

  // Derived once per render and reused across the form + report pane.
  const subj = subject.trim();
  const canRun = subj.length >= 2;
  const configReady = configState === "live" || configState === "demo";
  // One label + one reason, shared by the header primary and the brief-panel
  // CTA — the two previously computed the same ternary independently and one
  // was allowed to look enabled while the other was disabled with a reason.
  const runLabel = running
    ? "Researching…"
    : configState === "demo"
      ? "Run example research"
      : configState === "live"
        ? "Run deep research"
        : "Research configuration unavailable";
  const runReason = running
    ? "Research in progress"
    : !configReady
      ? "Research configuration unavailable"
      : !canRun
        ? `Enter a ${mode === "sector" ? "sector" : "issuer"} above to run`
        : null;
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

  // Watch a durable job (fresh or reattached) to terminal, driving the running →
  // result/error dispatch. `prevResult` is retained so a *failed rerun* doesn't
  // leave the analyst with nothing — the prior report is one click away (H5).
  async function watch(poll: Promise<ResearchResult>, ctrl: AbortController) {
    pollAbort.current?.abort(); // single active poll — a superseded one must not resolve into stale UI
    pollAbort.current = ctrl;
    setRunning(true);
    setError(null);
    setProgress(null);
    try {
      const done = await poll;
      setResult(done);
      setPrevResult(null); // the new report is the report now
      const context = analysis.context;
      const jobId = activeJobId.current;
      if (context && jobId) {
        try {
          const nextSurfaceState = {
            ...context.surface_state,
            research: {
              ...(context.surface_state.research ?? {}),
              active_id: jobId,
              query: subj || null,
              view: "result",
            },
          };
          await analysis.patch({
            artifacts: { ...context.artifacts, research_job_id: jobId },
            surface_state: nextSurfaceState,
          });
          await analysisApi.createFinding({
            context_id: context.id,
            kind: "research",
            title: subj ? `${subj} research` : "Research finding",
            body: done.report.slice(0, 1200),
            source_surface: "research",
            source_run_id: jobId,
            evidence: { source_count: done.sources.length, truncated: done.truncated },
          }).catch(() => undefined);
        } catch {
          notify("Research saved", "The report completed, but its context link needs retry.");
        }
      }
      // Keep the durable job id in sessionStorage after a successful run (H3): the
      // completed job stays server-side and retrievable, so if the analyst hops to
      // Deep-Dive to cross-check a figure and returns (or reloads), the mount effect
      // re-fetches this id — which resolves status=complete and hydrates straight
      // into ResultView — instead of forfeiting a 2–4-minute, real-spend report. A
      // fresh Run overwrites the id via onJobId, so it only ever points at the
      // report currently on screen; only failed/gone terminals clear it below.
      // subj is empty on a reattached run (per-run field cleared by the reload),
      // so fall back to the scope alone rather than a dangling "· ".
      notify("Research complete", subj ? `${mode === "sector" ? "Sector" : "Issuer"} · ${subj}` : `${mode === "sector" ? "Sector" : "Issuer"} research`);
    } catch (e: unknown) {
      if (isResearchAborted(e)) return; // detach/unmount — leave the durable job alone
      if (isResearchGone(e)) {
        // Stale/foreign reattach id — the job no longer exists. Drop it quietly and
        // fall back to whatever was on screen; never a scary "Research failed".
        _storeJobId(analystId, analysis.context?.id, null);
        return; // finally clears `running`
      }
      // toErrorMessage handles the 422 list-shaped detail that a bare
      // `detail ?? fallback` would render as a crashing JSX child. (SEAM3-1)
      const msg = toErrorMessage(e, "Research failed — try again.");
      setError(msg);
      _storeJobId(analystId, analysis.context?.id, null); // terminal — nothing durable left to reattach
      notify("Research failed", msg);
    } finally {
      // Only the currently-active controller clears running — a stale watch whose
      // signal was superseded must not flip the UI out of a newer run.
      if (pollAbort.current === ctrl) {
        setRunning(false);
        pollAbort.current = null;
      }
    }
  }

  function run() {
    if (!canRun || running) return;
    // Keep the prior report reachable while the replacement is produced — a stray
    // Run (or a "just tweak the timeframe" rerun) must not erase a 2–4-minute
    // report before its successor exists (H5).
    setPrevResult(result);
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
    const ctrl = new AbortController();
    // deepResearch persists the durable id via onJobId → sessionStorage before the
    // multi-minute poll, so a mid-run reload reattaches instead of orphaning it.
    void watch(
      deepResearch(brief, setProgress, (id) => {
        activeJobId.current = id;
        _storeJobId(analystId, analysis.context?.id, id);
      }, ctrl.signal, analysis.context?.id),
      ctrl,
    );
  }

  // Detach — stop watching but leave the durable run going server-side. The stored
  // id survives, so a reload (or coming back to the tab) reattaches to it. Honest
  // copy: the run is NOT cancelled (there is no server cancel endpoint).
  function detach() {
    pollAbort.current?.abort();
    pollAbort.current = null;
    setRunning(false);
    setProgress(null);
    notify("Detached", "The run continues in the background — reload to reattach.");
  }

  // maxLength mirrors the server-side ResearchBrief caps (deepresearch.py) so
  // the 422 validation error is unreachable from typing. (SEAM3-1)
  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    maxLength: number,
    big = false, // the primary subject input — reads as the page's focal title entry
  ) => (
    <label className="flex flex-col gap-1">
      <span className={big ? "tabular text-caos-2xs uppercase tracking-wider text-caos-text" : labelCls}>{label}</span>
      <TextInput
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={"w-full px-2 " + (big ? "py-2.5 text-[16px] leading-tight" : "py-1.5 text-caos-md")}
      />
    </label>
  );

  const area = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    maxLength?: number,
    rows = 2,
  ) => (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={INPUT_BASE + " w-full px-2 py-1.5 text-caos-md leading-snug resize-y"}
      />
    </label>
  );

  return (
    <EnterprisePage kind="analytical"
      identity={<ShellIdentity title="Deep Research — sector & issuer credit intelligence" />}
      primaryAction={
        <ActionReason reason={runReason} reasonDisplay="hidden" onClick={run} className="caos-action-primary focus-ring">
          {runLabel}
        </ActionReason>
      }
      contextualControls={
        result && analysis.context ? (
          <>
            {analysis.context.issuer_ids[0] ? (
              <Link href={contextHref("/deepdive", analysis.context.id, { issuer: analysis.context.issuer_ids[0] })} className="caos-secondary-action focus-ring no-underline">Open Deep-Dive</Link>
            ) : null}
            <Link href={contextHref("/reports", analysis.context.id)} className="caos-secondary-action focus-ring no-underline">Open Report Studio</Link>
          </>
        ) : null
      }
      narrowContract={{ essentialControls: null }}
    >
      {/* workspace — brief (left) drives the report (right) */}
      <div className="caos-persona-route research-workbench flex-1 min-h-0 p-2">
      <PersonaWorkbench surface="research" context={<Panel title="Research brief">
          {/* min-h-full (not h-full): fills the panel when short, and grows so the
              panel's own overflow-auto scrolls when the advanced section is open —
              no flex-1 child to collapse and overlap on a short viewport. */}
          <div className="min-h-full p-3 flex flex-col gap-4">
            {configState === "demo" && (
              <div
                className="flex items-baseline gap-2 px-2.5 py-2 rounded border"
                style={{ borderColor: "var(--caos-warning)", background: "color-mix(in srgb, var(--caos-warning) 6%, transparent)" }}
              >
                <span className="tabular text-caos-2xs uppercase tracking-wider shrink-0" style={{ color: "var(--caos-warning)" }}>Demo mode</span>
                <span className="text-caos-xs text-caos-muted leading-snug">No model key configured — runs return a canned example report.</span>
              </div>
            )}
            {configState === "loading" ? (
              <p role="status" className="text-caos-xs text-caos-muted">Checking live/demo research configuration…</p>
            ) : null}
            {configState === "error" ? (
              <div role="alert" className="flex items-center gap-2 rounded border border-caos-critical/50 px-2.5 py-2">
                <span className="flex-1 text-caos-xs text-caos-critical">Research configuration unavailable. No run will start until provenance is confirmed.</span>
                <button type="button" className="caos-action-secondary focus-ring" onClick={() => void loadResearchConfiguration()}>Retry configuration</button>
              </div>
            ) : null}
            {reattachError ? (
              <div role="alert" className="flex items-center gap-2 rounded border border-caos-warning/50 px-2.5 py-2">
                <span className="flex-1 text-caos-xs text-caos-warning">{reattachError}. The saved job remains attached.</span>
                <button type="button" className="caos-action-secondary focus-ring" onClick={() => setReattachRetry((value) => value + 1)}>Retry reattachment</button>
              </div>
            ) : null}

            {/* Essentials — the whole job: pick a grain, name the subject. */}
            <div className="flex flex-col gap-3">
              <ScopeToggle value={mode} onChange={setMode} label="Scope" ariaLabel="Research scope" />
              {field(
                mode === "sector" ? "Sector / theme" : "Issuer",
                subject,
                setSubject,
                mode === "sector" ? "e.g. enterprise software (NA & EU)" : "e.g. Atlas Forge",
                300,
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
                    {field("Audience", audience, setAudience, "the credit investment committee", 200)}
                    {field("Decision to inform", decision, setDecision, "position sizing and credit selection", 300)}
                    {field("Timeframe", timeframe, setTimeframe, "the last 12 months to present", 200)}
                  </div>
                  <div className="flex flex-col gap-3">
                    {area("Focus areas (optional)", focus, setFocus, "geographies, sub-segments, capital-structure tiers…", 1000)}
                    {area("Exclusions (optional)", exclusions, setExclusions, "topics to avoid…", 1000)}
                    {/* criteria is a server-capped 15-item LIST, not char-capped; an
                        over-long list 422 degrades to a readable message via toErrorMessage */}
                    {area("Investigation criteria — one per line", criteria, setCriteria, "", undefined, 7)}
                  </div>
                  <AiModeToggle value={aiMode} onChange={setAiMode} />
                </div>
              )}
            </div>

            {/* Action — the primary move: a solid, confident button, anchored to
                the panel foot (mt-auto) so it never floats mid-form. */}
            <div className="flex flex-col gap-2 mt-auto pt-1">
              <ActionReason
                reason={runReason}
                onClick={run}
                className={
                  "text-caos-md font-semibold px-3 py-2.5 rounded border transition-caos focus-ring " +
                  (running
                    ? "bg-caos-elevated border-caos-border text-caos-muted cursor-wait"
                    : !canRun || !configReady
                      ? "bg-caos-elevated border-caos-border text-caos-muted"
                      : "bg-caos-accent border-caos-accent text-caos-bg hover:brightness-110")
                }
              >
                {runLabel}
              </ActionReason>
            </div>
          </div>
        </Panel>}

        primary={<ReportPane
          running={running}
          error={error}
          result={result}
          prevResult={prevResult}
          progress={progress}
          criteria={criteriaList}
          elapsed={elapsed}
          subj={subj}
          mode={mode}
          onDetach={detach}
          onRestorePrev={() => {
            setResult(prevResult);
            setPrevResult(null);
            setError(null);
          }}
        />}
      />
      </div>
    </EnterprisePage>
  );
}
