"use client";

// Settings — utility chrome (not a concept). Two halves:
//  1. Research defaults — per-analyst standing lens, saved in this browser
//     (localStorage), consumed by the Research page's brief form.
//  2. Workspace configuration — a read-only mirror of the server's env-driven
//     config (governance, engine cost, models, retrieval). Editing these means
//     changing the environment and restarting; the page names the env var for
//     each. Secrets are never shown.

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { ScopeToggle } from "@/components/shared/ScopeToggle";
import { labelCls } from "@/components/shared/styles";
import { Panel } from "@/components/shared/Panel";
import { TextInput, INPUT_BASE } from "@/components/shared/TextInput";
import { getAnalystSettings, getSettings, saveAnalystSettings, type AnalystSettings, type WorkspaceSettings } from "@/lib/api";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type ResearchPrefs } from "@/lib/research-prefs";
import { AiModeToggle } from "@/components/shared/AiModeToggle";
import { ModelModeToggle } from "@/components/shared/ModelModeToggle";
import { loadMode, saveMode, DEFAULT_MODE, type ModelMode } from "@/lib/model-mode";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

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
  const [tab, setTab] = useState<"models" | "research" | "email" | "workspace">("models");
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
  useEffect(() => {
    setQueryModel(localStorage.getItem("caos_query_model") || "claude-sonnet-4-6");
    getAnalystSettings().then(setAnalystSettings).catch(() => {});
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
    setAnalystSettings(next);
    saveAnalystSettings(next).then(() => {
      setAnalystSaved(true);
      window.setTimeout(() => setAnalystSaved(false), 2000);
    }).catch(() => {});
  };

  // ── Workspace config (server snapshot) ──
  const [cfg, setCfg] = useState<WorkspaceSettings | null>(null);
  const [cfgErr, setCfgErr] = useState(false);
  useEffect(() => {
    getSettings().then(setCfg).catch(() => setCfgErr(true));
  }, []);

  const prefField = (
    label: string,
    value: string,
    k: keyof ResearchPrefs,
    placeholder: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <TextInput
        value={value}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-caos-md"
      />
    </label>
  );

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <PageSubHeader>
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Settings</span>
        <div className="flex-1" />
        {cfg ? <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">{cfg.workspace.environment} · model {cfg.model}</span> : null}
      </PageSubHeader>

      {/* body */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1 rounded border border-caos-border bg-caos-panel p-1">
            {[
              ["models", "Models"],
              ["research", "Research"],
              ["email", "Email Intel"],
              ["workspace", "Workspace"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k as typeof tab)}
                className={
                  "tabular text-caos-xs uppercase tracking-wider rounded px-2 py-1.5 transition-caos focus-ring " +
                  (tab === k ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {/* Model mode */}
          {tab === "models" ? <Panel title="Model mode · saved in this browser">
            <div className="p-3 flex flex-col gap-3">
              <p className="tabular text-caos-2xs text-caos-muted leading-snug">
                The cost↔quality tier the engine runs its LLM lanes at — module synthesis, the
                adversarial council, issuer chat, and queries. Sent with every request; each run
                pins the mode it ran at. Applies to this browser.
              </p>
              <ModelModeToggle value={mode} onChange={changeMode} />
            </div>
          </Panel> : null}

          {/* Query model */}
          {tab === "models" ? <Panel title="Query Model · saved in this browser">
            <div className="p-3 flex flex-col gap-3">
              <p className="tabular text-caos-2xs text-caos-muted leading-snug">
                The language model used by the Query workspace and the global Ask launcher to translate
                natural language questions into metric graphs and semantic lookups. Applies to this browser.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {[
                  { id: "claude-sonnet-4-6", name: "Claude 3.5 Sonnet", configured: cfg?.llm_configured ?? true, reqKey: "ANTHROPIC_API_KEY" },
                  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", configured: cfg?.gemini_configured ?? false, reqKey: "GEMINI_API_KEY" },
                  { id: "deepseek/deepseek-chat", name: "DeepSeek V3/V4", configured: cfg?.openrouter_configured ?? false, reqKey: "OPENROUTER_API_KEY" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => changeQueryModel(m.id)}
                    className={
                      "flex-1 text-left p-3 rounded border transition-caos focus-ring " +
                      (queryModel === m.id
                        ? "bg-caos-accent/10 border-caos-accent text-caos-accent font-semibold"
                        : "bg-caos-panel border-caos-border text-caos-text hover:border-caos-accent/50")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="tabular text-caos-md font-semibold">{m.name}</span>
                      <span 
                        className="h-1.5 w-1.5 rounded-full shrink-0" 
                        style={{ background: m.configured ? "var(--caos-success)" : "var(--caos-idle)" }}
                      />
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
          </Panel> : null}

          {tab === "models" ? (
            <Panel
              title="Custom model routing · saved to analyst profile"
              right={analystSaved ? <span className="caos-enter tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>Saved</span> : null}
            >
              <div className="p-3 flex flex-col gap-2">
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
                      onChange={(e) => saveAnalyst({
                        ...analystSettings,
                        model_lanes: { ...analystSettings.model_lanes, [lane]: e.target.value },
                      })}
                      className="rounded border border-caos-border bg-caos-elevated px-2 py-1.5 tabular text-caos-md text-caos-text focus-ring"
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
          ) : null}

          {/* Research defaults */}
          {tab === "research" ? <Panel
            title="Research defaults · saved in this browser"
            right={
              <span className="flex items-center gap-3">
                {saved ? <span className="caos-enter tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>Saved</span> : null}
                <button
                  onClick={() => { setPrefs(DEFAULT_PREFS); setSaved(false); }}
                  className="tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos"
                >
                  Reset
                </button>
                <button
                  onClick={save}
                  className="tabular text-caos-xs px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
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
              {prefField("Audience", prefs.audience, "audience", "the credit investment committee")}
              {prefField("Decision to inform", prefs.decision, "decision", "position sizing and credit selection")}
              {prefField("Timeframe", prefs.timeframe, "timeframe", "the last 12 months to present")}
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
          </Panel> : null}

          {tab === "email" ? (
            <Panel
              title="Email Intelligence · Outlook connection"
              right={<span className="tabular text-caos-xs text-caos-muted">feed built near production</span>}
            >
              <div className="p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded border border-caos-border bg-caos-bg px-3 py-2">
                  <span className="tabular text-caos-md text-caos-text">Outlook connection</span>
                  <span className="tabular text-caos-xs text-caos-muted">Not connected</span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Approved sender emails/domains</span>
                  <textarea
                    rows={8}
                    value={(analystSettings.email_intelligence.approved_senders || []).join("\n")}
                    onChange={(e) => setAnalystSettings({
                      ...analystSettings,
                      email_intelligence: {
                        ...analystSettings.email_intelligence,
                        approved_senders: e.target.value.split(/\n|,/).map((x) => x.trim()).filter(Boolean),
                      },
                    })}
                    onBlur={() => saveAnalyst()}
                    className={INPUT_BASE + " w-full px-2 py-1.5 text-caos-md resize-y leading-snug"}
                  />
                </label>
                {analystSaved ? <span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>Saved</span> : null}
              </div>
            </Panel>
          ) : null}

          {/* Workspace configuration */}
          {tab === "workspace" ? <Panel
            title="Workspace configuration · set via environment, restart to change"
            right={cfg && !cfg.llm_configured ? <span className="tabular text-caos-xs" style={{ color: "var(--caos-warning)" }}>NO MODEL KEY · demo mode</span> : null}
          >
            <div className="p-3">
              {cfgErr ? (
                <p className="tabular text-caos-md text-caos-muted">Couldn’t load workspace configuration.</p>
              ) : !cfg ? (
                <p className="tabular text-caos-md text-caos-muted">Loading…</p>
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
          </Panel> : null}
        </div>
      </div>
    </div>
  );
}
