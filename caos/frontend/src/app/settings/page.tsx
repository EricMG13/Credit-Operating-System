"use client";

// Settings — utility chrome (not a concept). Two halves:
//  1. Research defaults — per-analyst standing lens, saved in this browser
//     (localStorage), consumed by the Research page's brief form.
//  2. Workspace configuration — a read-only mirror of the server's env-driven
//     config (governance, engine cost, models, retrieval). Editing these means
//     changing the environment and restarting; the page names the env var for
//     each. Secrets are never shown.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { RoleViewSwitch } from "@/components/shared/RoleViewSwitch";
import { ScopeToggle } from "@/components/shared/ScopeToggle";
import { ScopeLabel } from "@/components/shared/ScopeLabel";
import { labelCls } from "@/components/shared/styles";
import { Panel } from "@/components/shared/Panel";
import { TextInput, INPUT_BASE } from "@/components/shared/TextInput";
import { getAnalystSettings, getSettings, patchAnalystSettings, type AnalystSettings, type WorkspaceSettings } from "@/lib/api";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type ResearchPrefs } from "@/lib/research-prefs";
import { AiModeToggle } from "@/components/shared/AiModeToggle";
import { ModelModeToggle } from "@/components/shared/ModelModeToggle";
import { loadMode, saveMode, DEFAULT_MODE, type ModelMode } from "@/lib/model-mode";
import { PortfoliosPanel } from "@/components/settings/PortfoliosPanel";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { readWarnOnUnsavedLeave, writeWarnOnUnsavedLeave } from "@/lib/model-builder-preferences";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    </RequireAuth>
  );
}

const TABS = [
  ["models", "Models"],
  ["research", "Research"],
  ["email", "Email Intel"],
  ["portfolios", "Portfolios"],
  ["workspace", "Workspace"],
] as const;
type Tab = (typeof TABS)[number][0];

// Maps the WorkspaceSettings snapshot → display groups. `hint` is the env var
// (or code location) that controls each value. Built per-render from `cfg`.
function configGroups(cfg: WorkspaceSettings) {
  return [
    {
      title: "Models",
      rows: [
        { label: "Model", value: cfg.model, hint: "ANTHROPIC_MODEL" },
        { label: "Model key configured", value: cfg.llm_configured, hint: "ANTHROPIC_API_KEY" },
        { label: "Gemini key configured", value: cfg.gemini_configured, hint: "GEMINI_API_KEY" },
        { label: "OpenRouter key configured", value: cfg.openrouter_configured, hint: "OPENROUTER_API_KEY" },
        { label: "Synth executor", value: cfg.engine_cost.synth_executor_model, hint: "SYNTH_EXECUTOR_MODEL" },
        { label: "Advisor model", value: cfg.engine_cost.advisor_model, hint: "ADVISOR_MODEL" },
      ],
    },
    {
      title: "Model tiers (mode → model)",
      rows: [
        { label: "Cheap — TEST, light/extract", value: cfg.model_tiers.cheap, hint: "MODEL_TIER_CHEAP" },
        { label: "Fast — LITE heavy, light lanes", value: cfg.model_tiers.fast, hint: "MODEL_TIER_FAST" },
        { label: "Strong — BALANCED heavy", value: cfg.model_tiers.strong, hint: "MODEL_TIER_STRONG" },
        { label: "Top — MAX heavy", value: cfg.model_tiers.top, hint: "MODEL_TIER_TOP" },
      ],
    },
    {
      title: "Governance & QA",
      rows: [
        { label: "Council (CP-5C semantic review)", value: cfg.governance.council_enabled, hint: "COUNCIL_ENABLED" },
        { label: "Council seats", value: cfg.governance.council_seats, hint: "COUNCIL_SEATS" },
        { label: "Council peer round", value: cfg.governance.council_peer_round, hint: "COUNCIL_PEER_ROUND" },
        { label: "Cross-model council review", value: cfg.governance.council_cross_model, hint: "COUNCIL_CROSS_MODEL" },
        { label: "Adversarial debate (CP-6A) narration", value: cfg.governance.debate_enabled, hint: "DEBATE_ENABLED" },
      ],
    },
    {
      title: "Engine cost & limits",
      rows: [
        { label: "Per-run token budget (0 = unlimited)", value: cfg.engine_cost.run_token_budget, hint: "RUN_TOKEN_BUDGET" },
        { label: "Advisor tool", value: cfg.engine_cost.advisor_enabled, hint: "ADVISOR_ENABLED" },
        { label: "Run concurrency", value: cfg.workspace.run_concurrency, hint: "CAOS_RUN_CONCURRENCY" },
        { label: "Max upload (MB)", value: cfg.workspace.max_upload_mb, hint: "MAX_UPLOAD_MB" },
      ],
    },
    {
      title: "Deep Research",
      rows: [
        { label: "Reasoning effort", value: cfg.deep_research.effort, hint: "deepresearch.py · _EFFORT" },
        { label: "Max web searches / run", value: cfg.deep_research.max_searches, hint: "deepresearch.py · _MAX_SEARCHES" },
        { label: "Max report tokens", value: cfg.deep_research.max_tokens, hint: "deepresearch.py · _MAX_TOKENS" },
      ],
    },
    {
      title: "Retrieval & data",
      rows: [
        { label: "SEC EDGAR lane", value: cfg.retrieval.edgar_enabled, hint: "EDGAR_USER_AGENT" },
        { label: "markitdown extractor", value: cfg.retrieval.markitdown_enabled, hint: "MARKITDOWN_CMD" },
      ],
    },
    {
      title: "Workspace",
      rows: [
        { label: "Environment", value: cfg.workspace.environment, hint: "ENVIRONMENT" },
        { label: "Demo seed data", value: cfg.workspace.demo_seed, hint: "CAOS_DEMO_SEED" },
      ],
    },
  ];
}

function ConfigVal({ v }: { v: boolean | number | string }) {
  if (typeof v === "boolean") {
    return (
      <span className="flex items-center gap-1.5 tabular text-caos-md">
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: v ? "var(--caos-success)" : "var(--caos-idle)" }}
        />
        {v ? "On" : "Off"}
      </span>
    );
  }
  return <span className="tabular text-caos-md text-caos-text">{String(v)}</span>;
}

// Dense analyst page (browser-local defaults + server config mirror); same
// structural shape as ModelBuilder/ReportStudio. Splitting it would only
// prop-drill state for no readability gain.
// fallow-ignore-next-line complexity
function Settings() {
  // ── Active tab, synced to ?tab= so reload/back restores the section ──
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.some(([k]) => k === tabParam) ? (tabParam as Tab) : "models";
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };
  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIdx = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = TABS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const nextTab = TABS[nextIdx][0];
    selectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  // ── Research defaults (browser-local) ──
  const [prefs, setPrefs] = useState<ResearchPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  useEffect(() => setPrefs(loadPrefs()), []);

  // ── Model mode (browser-local, immediate-save) ──
  const [mode, setMode] = useState<ModelMode>(DEFAULT_MODE);
  useEffect(() => { setMode(loadMode()); }, []);
  const changeMode = (m: ModelMode) => { setMode(m); saveMode(m); };

  // ── Query model (browser-local, immediate-save) ──
  const [queryModel, setQueryModel] = useState<string>("claude-sonnet-4-6");
  const [analystSettings, setAnalystSettings] = useState<AnalystSettings>({ model_lanes: {}, email_intelligence: { approved_senders: [] } });
  const [analystSaved, setAnalystSaved] = useState(false);
  const [analystErr, setAnalystErr] = useState<string | null>(null);
  // Holds the exact settings payload of a failed save so "Retry save" can re-PUT
  // it without the analyst re-doing anything. `null` when there's nothing to retry.
  const [analystRetry, setAnalystRetry] = useState<AnalystSettings | null>(null);
  // Guard against overwriting the server profile before it has loaded: a failed
  // mount fetch leaves state at the empty default, and saving that would wipe the
  // analyst's stored lanes/senders. `analystLoaded` gates every write.
  const [analystLoaded, setAnalystLoaded] = useState(false);
  const [analystLoadErr, setAnalystLoadErr] = useState(false);
  // Raw textarea buffer for approved senders — parsed to the array only on save,
  // so Enter/commas stick while typing instead of being stripped every keystroke.
  const [sendersRaw, setSendersRaw] = useState("");
  const loadAnalyst = () => {
    setAnalystLoadErr(false);
    getAnalystSettings()
      .then((s) => {
        setAnalystSettings(s);
        setSendersRaw((s.email_intelligence?.approved_senders || []).join("\n"));
        const workspace = s.workspace || {};
        const serverPrefs = workspace.research_prefs;
        if (serverPrefs && typeof serverPrefs === "object") {
          setPrefs({ ...DEFAULT_PREFS, ...(serverPrefs as Partial<ResearchPrefs>) });
        }
        if (typeof workspace.model_mode === "string" && ["test", "lite", "balanced", "max"].includes(workspace.model_mode)) {
          setMode(workspace.model_mode as ModelMode);
        }
        if (typeof workspace.query_model === "string") setQueryModel(workspace.query_model);
        setAnalystLoaded(true);
      })
      .catch(() => setAnalystLoadErr(true));
  };
  useEffect(() => {
    setQueryModel(localStorage.getItem("caos_query_model") || "claude-sonnet-4-6");
    loadAnalyst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const changeQueryModel = (m: string) => {
    setQueryModel(m);
    localStorage.setItem("caos_query_model", m);
  };

  const set = <K extends keyof ResearchPrefs>(k: K, v: ResearchPrefs[K]) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };
  function save() {
    savePrefs(prefs);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  const saveAnalyst = (next = analystSettings) => {
    // Never PUT before the profile has loaded — that would push the empty default
    // over the analyst's stored settings.
    if (!analystLoaded) return;
    // Snapshot the last-persisted structured settings so a failed PUT can roll the
    // optimistic control state (lane selects) back — those controls must never keep
    // showing a value the server rejected. The `sendersRaw` textarea buffer is
    // deliberately NOT rolled back: it is hand-typed, possibly-long trust-list work,
    // and restoring it to a stale snapshot on a transient 5xx would delete the very
    // addresses the error is warning weren't stored. We keep it as typed and offer
    // "Retry save" instead (H9 — preserve the analyst's work).
    const prevSettings = analystSettings;
    setAnalystSettings(next);
    setAnalystErr(null);
    setAnalystRetry(null);
    patchAnalystSettings(analystSettings.revision ?? 0, {
      model_lanes: next.model_lanes,
      email_intelligence: next.email_intelligence,
      role_view: next.role_view,
      workspace: next.workspace,
    }).then((savedSettings) => {
      setAnalystSettings(savedSettings);
      setAnalystSaved(true);
      window.setTimeout(() => setAnalystSaved(false), 2000);
    }).catch((e) => {
      const detail = e?.response?.data?.detail;
      setAnalystSettings(prevSettings);
      setAnalystRetry(next);
      setAnalystErr(typeof detail === "string" && detail ? detail : "Save failed — not stored");
    });
  };
  const analystStatusTag = analystLoadErr ? (
    <span role="alert" className="flex items-center gap-2 tabular text-caos-xs" style={{ color: "var(--caos-critical)" }}>
      ✗ Profile didn’t load — editing disabled
      <button
        type="button"
        onClick={loadAnalyst}
        className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring"
      >
        Retry
      </button>
    </span>
  ) : !analystLoaded ? (
    <span className="tabular text-caos-xs text-caos-muted">Loading profile…</span>
  ) : analystErr ? (
    <span role="alert" className="flex items-center gap-2 tabular text-caos-xs" style={{ color: "var(--caos-critical)" }}>
      ✗ {analystErr}
      {analystRetry ? (
        <button
          type="button"
          onClick={() => saveAnalyst(analystRetry)}
          className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring"
        >
          Retry save
        </button>
      ) : null}
    </span>
  ) : analystSaved ? (
    <span className="caos-enter tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>Saved</span>
  ) : null;
  const warnOnUnsavedLeave = readWarnOnUnsavedLeave(analystSettings);
  const changeWarnOnUnsavedLeave = (enabled: boolean) => {
    saveAnalyst({
      ...analystSettings,
      workspace: writeWarnOnUnsavedLeave(analystSettings.workspace || {}, enabled),
    });
  };

  // ── Workspace config (server snapshot) ──
  const [cfg, setCfg] = useState<WorkspaceSettings | null>(null);
  const [cfgErr, setCfgErr] = useState(false);
  const loadCfg = () => {
    setCfgErr(false);
    getSettings().then(setCfg).catch(() => setCfgErr(true));
  };
  useEffect(() => {
    loadCfg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAll = () => {
    if (!analystLoaded) return;
    savePrefs(prefs);
    saveMode(mode);
    localStorage.setItem("caos_query_model", queryModel);
    saveAnalyst({
      ...analystSettings,
      workspace: {
        ...(analystSettings.workspace || {}),
        research_prefs: prefs,
        model_mode: mode,
        query_model: queryModel,
      },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };


  return (
    <EnterprisePage kind="object"
      identity={<ShellIdentity title="Settings" />}
      primaryAction={<button type="button" onClick={saveAll} disabled={!analystLoaded} className="caos-primary-action focus-ring disabled:opacity-40">Save changes</button>}
      utilityLabel="Settings utilities"
      utilityControls={<button type="button" onClick={loadCfg} className="caos-action-secondary focus-ring">Refresh environment snapshot</button>}
      contextualControls={
        cfg ? (
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
            {cfg.workspace.environment} · model {cfg.model}
          </span>
        ) : undefined
      }
      narrowContract={{ essentialControls: null }}
    >
      {/* body */}
      <div className="caos-persona-route settings-workbench flex-1 min-h-0 overflow-auto p-2">
      <PersonaWorkbench surface="settings" primary={<div>
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <div
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="horizontal"
            className="grid grid-cols-5 gap-1 rounded border border-caos-border bg-caos-panel p-1"
          >
            {TABS.map(([k, label], idx) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  role="tab"
                  id={`settings-tab-${k}`}
                  aria-selected={active}
                  aria-controls={`settings-panel-${k}`}
                  tabIndex={active ? 0 : -1}
                  ref={(el) => { tabRefs.current[k] = el; }}
                  onClick={() => selectTab(k)}
                  onKeyDown={(e) => onTabKeyDown(e, idx)}
                  className={
                    "tabular text-caos-xs uppercase tracking-wider rounded border px-2 py-1.5 transition-caos focus-ring " +
                    (active
                      ? "bg-caos-elevated text-caos-text border-caos-accent"
                      : "border-transparent text-caos-muted hover:text-caos-text hover:border-caos-border")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* Models tab */}
          {tab === "models" ? (
          <div id="settings-panel-models" role="tabpanel" aria-labelledby="settings-tab-models" className="flex flex-col gap-2">
          {/* Role view — mirrors the header selector; same provider state. */}
          <Panel title="Role view" right={<ScopeLabel scope="profile" />}>
            <div className="p-3 flex flex-col gap-3">
              <p className="tabular text-caos-2xs text-caos-muted leading-snug">
                Workspace presentation preference — chooses which composition analytical surfaces
                open with (Analyst working density, PM posture-first, QA governance-first). It is
                not access control: every view reads the same underlying data.
              </p>
              <RoleViewSwitch />
            </div>
          </Panel>

          {/* Model mode */}
          <Panel title="Model mode" right={<ScopeLabel scope="device" />}>
            <div className="p-3 flex flex-col gap-3">
              <p className="tabular text-caos-2xs text-caos-muted leading-snug">
                The cost↔quality tier the engine runs its LLM lanes at — module synthesis, the
                adversarial council, issuer chat, and queries. Sent with every request; each run
                pins the mode it ran at. Applies to this browser.
              </p>
              <ModelModeToggle value={mode} onChange={changeMode} />
            </div>
          </Panel>

          <Panel
            title="Model builder safeguards"
            right={
              <span className="flex items-center gap-2">
                <ScopeLabel scope="profile" />
                {analystStatusTag}
              </span>
            }
          >
            <div className="p-3">
              <label className="flex items-start justify-between gap-4 rounded border border-caos-border bg-caos-bg/50 p-3">
                <span className="min-w-0">
                  <span className="block tabular text-caos-md font-semibold text-caos-text">Warn before leaving unsaved model edits</span>
                  <span className="mt-1 block text-caos-xs leading-relaxed text-caos-muted">
                    Guards internal navigation and browser exit while Model Engine v2 edits are pending locally. Leaving never autosaves.
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Warn before leaving unsaved model edits"
                  checked={warnOnUnsavedLeave}
                  disabled={!analystLoaded}
                  onChange={(event) => changeWarnOnUnsavedLeave(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 focus-ring disabled:opacity-40"
                />
              </label>
            </div>
          </Panel>

          {/* Query model */}
          <Panel title="Query Model" right={<ScopeLabel scope="device" />}>
            <div className="p-3 flex flex-col gap-3">
              <p className="tabular text-caos-2xs text-caos-muted leading-snug">
                The language model used by the Query workspace and the global Ask launcher to translate
                natural language questions into metric graphs and semantic lookups. Applies to this browser.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {[
                  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", configured: cfg?.llm_configured ?? true, reqKey: "ANTHROPIC_API_KEY" },
                  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", configured: cfg?.gemini_configured ?? false, reqKey: "GEMINI_API_KEY" },
                  { id: "deepseek/deepseek-chat", name: "DeepSeek V3/V4", configured: cfg?.openrouter_configured ?? false, reqKey: "OPENROUTER_API_KEY" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => changeQueryModel(m.id)}
                    aria-pressed={queryModel === m.id}
                    className={
                      "flex-1 text-left p-3 rounded border transition-caos focus-ring " +
                      (queryModel === m.id
                        ? "bg-caos-accent/10 border-caos-accent text-caos-accent font-semibold"
                        : "bg-caos-panel border-caos-border text-caos-text hover:border-caos-accent/50")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular text-caos-md font-semibold flex items-center gap-1.5">
                        {queryModel === m.id ? (
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-caos-accent shrink-0"
                          />
                        ) : null}
                        {m.name}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {queryModel === m.id ? (
                          <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-accent">
                            Active
                          </span>
                        ) : null}
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: m.configured ? "var(--caos-success)" : "var(--caos-idle)" }}
                        />
                      </span>
                    </div>
                    <div className="tabular text-caos-3xs text-caos-muted font-mono mt-1 select-none">
                      {m.id}
                    </div>
                    {!m.configured && (
                      <div className="tabular text-caos-3xs text-caos-warning mt-1.5">
                        Requires {m.reqKey} in env
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
              title="Custom model routing"
              right={
                <span className="flex items-center gap-2">
                  <ScopeLabel scope="profile" />
                  {analystStatusTag}
                </span>
              }
            >
              <div className="p-3 flex flex-col gap-2">
                <p className="tabular text-caos-2xs text-caos-warning leading-snug">
                  Not yet applied — LLM lanes still run at the workspace tier above. Per-lane
                  wiring lands with the run-lane override rollout; these selects are disabled
                  until then. Any value already stored on your profile is shown, not cleared.
                </p>
                {[
                  ["module_synthesis", "Module synthesis"],
                  ["issuer_chat", "Issuer chat"],
                  ["query", "Query / Ask"],
                  ["reporting", "Report drafting"],
                ].map(([lane, label]) => (
                  <label key={lane} className="grid grid-cols-[150px_1fr] gap-2 items-center">
                    <span className={labelCls}>{label}</span>
                    <select
                      value={analystSettings.model_lanes[lane] || ""}
                      disabled
                      aria-disabled="true"
                      title="Not yet applied — activates with the run-lane override rollout"
                      onChange={() => {}}
                      className="rounded border border-caos-border bg-caos-elevated px-2 py-1.5 tabular text-caos-md text-caos-text focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Use workspace tier</option>
                      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                      <option value="claude-opus-4-8">claude-opus-4-8</option>
                      <option value="deepseek/deepseek-v4-flash">deepseek/deepseek-v4-flash</option>
                      <option value="deepseek/deepseek-v4-pro">deepseek/deepseek-v4-pro</option>
                      <option value="z-ai/glm-5.2">z-ai/glm-5.2</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    </select>
                  </label>
                ))}
              </div>
            </Panel>
          </div>
          ) : null}

          {/* Research defaults */}
          {tab === "research" ? (
          <div id="settings-panel-research" role="tabpanel" aria-labelledby="settings-tab-research">
          <Panel
            title="Research defaults"
            right={
              <span className="flex items-center gap-3">
                <ScopeLabel scope="device" />
                {saved ? <span className="caos-enter tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>Saved</span> : null}
                <button
                  onClick={() => { setPrefs(DEFAULT_PREFS); setSaved(false); }}
                  className="tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring"
                >
                  Reset
                </button>
                <button
                  onClick={save}
                  className="tabular text-caos-xs px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
                >
                  Save
                </button>
              </span>
            }
          >
            <div className="p-3 flex flex-col gap-3">
              <p className="tabular text-caos-2xs text-caos-muted leading-snug">
                The standing lens the Research page seeds new briefs with. Blank fields fall back to the server defaults.
              </p>
              <AiModeToggle value={prefs.ai_mode} onChange={(m) => set("ai_mode", m)} />
              <ScopeToggle
                value={prefs.mode}
                onChange={(m) => set("mode", m)}
                label="Default scope"
                ariaLabel="Default research scope"
              />
              <PrefField label="Audience" value={prefs.audience} onChange={(val) => set("audience", val)} placeholder="the credit investment committee" />
              <PrefField label="Decision to inform" value={prefs.decision} onChange={(val) => set("decision", val)} placeholder="position sizing and credit selection" />
              <PrefField label="Timeframe" value={prefs.timeframe} onChange={(val) => set("timeframe", val)} placeholder="the last 12 months to present" />
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Investigation criteria — one per line</span>
                <textarea
                  value={prefs.criteria}
                  onChange={(e) => set("criteria", e.target.value)}
                  rows={8}
                  className={INPUT_BASE + " w-full px-2 py-1.5 text-caos-md resize-y leading-snug"}
                />
              </label>
            </div>
          </Panel>
          </div>
          ) : null}

          {tab === "email" ? (
            <div id="settings-panel-email" role="tabpanel" aria-labelledby="settings-tab-email">
            <Panel
              title="Email Intelligence · Outlook connection"
              right={
                <span className="flex items-center gap-2">
                  <ScopeLabel scope="profile" />
                  <span className="tabular text-caos-xs text-caos-muted">feed built near production</span>
                </span>
              }
            >
              <div className="p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded border border-caos-border bg-caos-bg px-3 py-2">
                  <span className="tabular text-caos-md text-caos-text">Outlook connection</span>
                  {/* Read the persisted flag — this was a hardcoded "Not connected"
                      that ignored the fetched setting (audit 2026-07-10 F16). */}
                  <span
                    className="tabular text-caos-xs"
                    style={{ color: analystSettings.email_intelligence?.outlook_connected ? "var(--caos-success)" : "var(--caos-muted)" }}
                  >
                    {analystSettings.email_intelligence?.outlook_connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Approved sender emails/domains — one per line</span>
                  <textarea
                    rows={8}
                    value={sendersRaw}
                    disabled={!analystLoaded}
                    onChange={(e) => setSendersRaw(e.target.value)}
                    onBlur={() => {
                      const parsed = sendersRaw.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
                      saveAnalyst({
                        ...analystSettings,
                        email_intelligence: {
                          ...analystSettings.email_intelligence,
                          approved_senders: parsed,
                        },
                      });
                    }}
                    className={INPUT_BASE + " w-full px-2 py-1.5 text-caos-md resize-y leading-snug disabled:opacity-50 disabled:cursor-not-allowed"}
                  />
                </label>
                {analystStatusTag}
              </div>
            </Panel>
            </div>
          ) : null}

          {/* Workspace configuration */}
          {tab === "workspace" ? (
          <div id="settings-panel-workspace" role="tabpanel" aria-labelledby="settings-tab-workspace">
          <Panel
            title="Workspace configuration"
            right={
              <span className="flex items-center gap-2">
                <ScopeLabel scope="workspace" />
                {cfg && !cfg.llm_configured ? <span className="tabular text-caos-xs" style={{ color: "var(--caos-warning)" }}>NO MODEL KEY · demo mode</span> : null}
              </span>
            }
          >
            <div className="p-3">
              {cfgErr ? (
                <SurfaceState
                  kind="offline"
                  title="Workspace configuration unavailable"
                  detail="The deployment configuration could not be read. No local preference or server setting was changed."
                  primaryAction={<button type="button" onClick={loadCfg} className="caos-action-primary focus-ring">Retry</button>}
                />
              ) : !cfg ? (
                <SurfaceState kind="loading" title="Loading workspace configuration" compact />
              ) : (
                <div className="flex flex-col gap-4">
                  {configGroups(cfg).map((g) => (
                    <div key={g.title}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={labelCls}>{g.title}</span>
                        <span className="h-px flex-1 bg-caos-border/60" />
                      </div>
                      <div className="flex flex-col">
                        {g.rows.map((r) => (
                          <div key={r.label} className="flex items-center gap-3 py-1.5 border-b border-caos-border/60 last:border-0">
                            <span className="tabular text-caos-md text-caos-text flex-1 min-w-0">{r.label}</span>
                            <code className="tabular text-caos-2xs text-caos-muted hidden sm:block w-44 shrink-0 truncate bg-caos-bg/60 border border-caos-border/60 rounded px-1.5 py-0.5" title={r.hint}>{r.hint}</code>
                            <span className="shrink-0 text-right whitespace-nowrap min-w-[3rem] flex justify-end"><ConfigVal v={r.value} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="tabular text-caos-2xs text-caos-muted leading-snug pt-1">
                    Read-only. These are set in the deployment environment (or noted code constant) and applied at boot. Secrets (API keys, database URL, storage paths) are never shown here.
                  </p>
                </div>
              )}
            </div>
          </Panel>
          </div>
          ) : null}
          {tab === "portfolios" ? <PortfoliosPanel /> : null}
        </div>
      </div>} />
      </div>
    </EnterprisePage>
  );
}

function PrefField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-caos-md"
      />
    </label>
  );
}
