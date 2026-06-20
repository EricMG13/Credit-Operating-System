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
import { getSettings, type WorkspaceSettings } from "@/lib/api";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type ResearchPrefs } from "@/lib/research-prefs";
import { AiModeToggle } from "@/components/shared/AiModeToggle";

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
        { label: "Synth executor", value: cfg.engine_cost.synth_executor_model, hint: "SYNTH_EXECUTOR_MODEL" },
        { label: "Advisor model", value: cfg.engine_cost.advisor_model, hint: "ADVISOR_MODEL" },
      ],
    },
    {
      title: "Governance & QA",
      rows: [
        { label: "Council (CP-5C semantic review)", value: cfg.governance.council_enabled, hint: "COUNCIL_ENABLED" },
        { label: "Council seats", value: cfg.governance.council_seats, hint: "COUNCIL_SEATS" },
        { label: "Council peer round", value: cfg.governance.council_peer_round, hint: "COUNCIL_PEER_ROUND" },
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
  // ── Research defaults (browser-local) ──
  const [prefs, setPrefs] = useState<ResearchPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  useEffect(() => setPrefs(loadPrefs()), []);
  const set = <K extends keyof ResearchPrefs>(k: K, v: ResearchPrefs[K]) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };
  function save() {
    savePrefs(prefs);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

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
          {/* Research defaults */}
          <Panel
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
          </Panel>

          {/* Workspace configuration */}
          <Panel
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
          </Panel>
        </div>
      </div>
    </div>
  );
}
