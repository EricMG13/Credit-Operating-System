"use client";

// Concept G — Deep Research: autonomous, multi-source web research through a
// credit-analyst lens (mimics Gemini Deep Research). The analyst fills a
// structured brief (left); Claude runs the web_search server tool and returns a
// committee-ready Markdown credit report (right). Without a model key the server
// returns a canned demo report, so the concept stays demoable offline.

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { useAuth } from "@/components/shared/AuthProvider";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { ScopeToggle } from "@/components/shared/ScopeToggle";
import { AiModeToggle } from "@/components/shared/AiModeToggle";
import { labelCls } from "@/components/shared/styles";
import { Panel } from "@/components/shared/Panel";
import { TextInput, INPUT_BASE } from "@/components/shared/TextInput";
import { ReportPane } from "@/components/research/ReportPane";
import { useNotify } from "@/components/shared/Notifications";
import { deepResearch, resumeResearch, getResearchStatus, isResearchAborted, isResearchGone, getSettings, toErrorMessage, type ResearchBrief, type ResearchResult, type ResearchProgress } from "@/lib/api";
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

// The in-flight durable job id, kept in sessionStorage keyed per analyst so a
// reload / mid-run navigation can reattach to the same server-side run instead of
// orphaning it (H3). sessionStorage (not local) scopes it to this tab; keying by
// analyst id keeps a shared machine from cross-attaching another analyst's run —
// the GET is owner-scoped and 404s a foreign id anyway, but this avoids the round-
// trip. Value = the job id; absence = nothing in flight.
const _jobKey = (analystId: string) => `caos.research.job.${analystId}`;
const _loadJobId = (analystId: string): string | null => {
  try {
    return sessionStorage.getItem(_jobKey(analystId)) || null;
  } catch {
    return null; // private mode — resume just isn't available
  }
};
const _storeJobId = (analystId: string, id: string | null): void => {
  try {
    if (id) sessionStorage.setItem(_jobKey(analystId), id);
    else sessionStorage.removeItem(_jobKey(analystId));
  } catch {
    /* private mode — reattach just won't survive a reload */
  }
};

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
  const [prevResult, setPrevResult] = useState<ResearchResult | null>(null); // retained across a rerun (H5)
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const notify = useNotify();
  const { user } = useAuth();
  const analystId = user?.id ?? "";

  // Abort handle for the active poll loop — aborted on unmount (so a closed/renav'd
  // tab stops polling for up to 15 min) and on Detach. Aborting only stops the
  // client watching; the durable server-side job keeps running (H3).
  const pollAbort = useRef<AbortController | null>(null);

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
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!analystId || resumedRef.current) return;
    resumedRef.current = true;
    const stored = _loadJobId(analystId);
    if (!stored) return;
    let cancelled = false; // unmount before the probe resolves — don't touch state
    void getResearchStatus(stored)
      .then((st) => {
        if (cancelled) return;
        if (st.state === "complete") {
          // Keep the id: the report stays reachable across further reloads.
          setResult(st.result);
          return;
        }
        if (st.state === "running") {
          const ctrl = new AbortController();
          void watch(resumeResearch(stored, setProgress, ctrl.signal), ctrl).catch(() => {});
          return;
        }
        // gone (404/blip) or failed — the pointer is stale; drop it silently.
        _storeJobId(analystId, null);
      })
      .catch(() => {
        // Belt-and-braces: an unexpected throw must not orphan a stale id.
        if (!cancelled) _storeJobId(analystId, null);
      });
    return () => {
      cancelled = true;
    };
    // watch() itself surfaces terminal state for the running branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analystId]);

  // Abort the active poll on unmount so a closed / navigated-away tab stops
  // polling (previously it kept GETting for up to 15 min). The durable job is
  // untouched — its id is still in sessionStorage for the next mount to reattach.
  useEffect(() => () => pollAbort.current?.abort(), []);

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
        _storeJobId(analystId, null);
        return; // finally clears `running`
      }
      // toErrorMessage handles the 422 list-shaped detail that a bare
      // `detail ?? fallback` would render as a crashing JSX child. (SEAM3-1)
      const msg = toErrorMessage(e, "Research failed — try again.");
      setError(msg);
      _storeJobId(analystId, null); // terminal — nothing durable left to reattach
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
      deepResearch(brief, setProgress, (id) => _storeJobId(analystId, id), ctrl.signal),
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
        />
      </div>
    </div>
  );
}
