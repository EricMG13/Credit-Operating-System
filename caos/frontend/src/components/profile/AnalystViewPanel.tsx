"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { analystOpinionsApi, type AnalystEvidenceState, type AnalystOpinionHistory, type AnalystStance } from "@/lib/analyst-opinions";
import { toErrorMessage } from "@/lib/api";

const STANCE_LABEL: Record<AnalystStance, string> = {
  OVERWEIGHT: "Overweight",
  NEUTRAL: "Neutral",
  UNDERWEIGHT: "Underweight",
};

function sameStance(systemStance: string | null | undefined, stance: AnalystStance) {
  return systemStance?.trim().toUpperCase() === stance;
}

type AnalystViewPanelProps = {
  issuerId: string;
  systemStance?: string | null;
  sourceRunId?: string | null;
  contextId?: string | null;
};

type OpinionDraft = {
  stance: AnalystStance;
  conviction: string;
  evidenceState: AnalystEvidenceState;
  rationale: string;
  unresolved: string;
};

const INITIAL_DRAFT: OpinionDraft = { stance: "NEUTRAL", conviction: "", evidenceState: "supported", rationale: "", unresolved: "" };

function draftFromHistory(history: AnalystOpinionHistory): OpinionDraft | null {
  if (!history.current) return null;
  return {
    stance: history.current.stance,
    conviction: history.current.conviction == null ? "" : String(history.current.conviction),
    evidenceState: history.current.evidence_state,
    rationale: history.current.rationale_md,
    unresolved: history.current.unresolved_items.join("\n"),
  };
}

function useOpinionHistory(issuerId: string, setDraft: React.Dispatch<React.SetStateAction<OpinionDraft>>) {
  const [history, setHistory] = useState<AnalystOpinionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    analystOpinionsApi.list(issuerId)
      .then((next) => {
        if (stale) return;
        setHistory(next);
        const nextDraft = draftFromHistory(next);
        if (nextDraft) setDraft(nextDraft);
      })
      .catch((reason) => !stale && setError(toErrorMessage(reason, "Analyst view unavailable.")))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [issuerId, setDraft]);
  return { history, setHistory, loading, error, setError };
}

function unresolvedItems(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function parseConviction(value: string) {
  if (value.trim() === "") return { value: null, error: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return { value: null, error: "Conviction must be a finite percentage from 0 to 100." };
  return { value: parsed, error: null };
}

function canSubmitOpinion(draft: OpinionDraft, saving: boolean) {
  if (!draft.rationale.trim() || saving) return false;
  return draft.evidenceState !== "provisional" || unresolvedItems(draft.unresolved).length > 0;
}

function opinionRequest(props: AnalystViewPanelProps, draft: OpinionDraft) {
  const conviction = parseConviction(draft.conviction);
  if (conviction.error) return { error: conviction.error, payload: null };
  return {
    error: null,
    payload: {
      stance: draft.stance,
      conviction: conviction.value,
      rationale_md: draft.rationale.trim(),
      evidence_state: draft.evidenceState,
      unresolved_items: unresolvedItems(draft.unresolved),
      source_run_id: props.sourceRunId ?? null,
      context_id: props.contextId ?? null,
    },
  };
}

function useAnalystViewModel(props: AnalystViewPanelProps) {
  const [draft, setDraft] = useState<OpinionDraft>(INITIAL_DRAFT);
  const [saving, setSaving] = useState(false);
  const historyState = useOpinionHistory(props.issuerId, setDraft);
  const current = historyState.history?.current ?? null;
  const updateDraft = <Key extends keyof OpinionDraft>(key: Key, value: OpinionDraft[Key]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const submit = async () => {
    if (!canSubmitOpinion(draft, saving)) return;
    const request = opinionRequest(props, draft);
    if (!request.payload) { historyState.setError(request.error); return; }
    setSaving(true);
    historyState.setError(null);
    try {
      const opinion = await analystOpinionsApi.create(props.issuerId, request.payload);
      historyState.setHistory((previous) => ({ current: opinion, items: [opinion, ...(previous?.items ?? [])] }));
    } catch (reason) {
      historyState.setError(toErrorMessage(reason, "Analyst view could not be saved."));
    } finally {
      setSaving(false);
    }
  };
  return { props, draft, updateDraft, saving, ...historyState, current, divergence: Boolean(current && !sameStance(props.systemStance, current.stance)), submit };
}

type AnalystViewModel = ReturnType<typeof useAnalystViewModel>;

function CurrentAnalystView({ model }: { model: AnalystViewModel }) {
  const current = model.current;
  if (!current) return null;
  return (
    <div className="border-y border-caos-border/40 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-caos-xs font-semibold text-caos-text">{STANCE_LABEL[current.stance]}{current.conviction != null ? ` · ${current.conviction}%` : ""}</span>
        <span className={`tabular text-caos-2xs uppercase tracking-wider ${model.divergence ? "text-caos-warning" : "text-caos-success"}`}>{model.divergence ? "Differs from system" : "Aligned with system"}</span>
      </div>
      <p className="m-0 mt-1 tabular text-caos-xs text-caos-muted">{current.evidence_state}{current.unresolved_items.length ? ` · ${current.unresolved_items.length} unresolved` : ""}</p>
    </div>
  );
}

function AnalystViewFields({ model }: { model: AnalystViewModel }) {
  return (
    <>
      <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Stance<select value={model.draft.stance} onChange={(event) => model.updateDraft("stance", event.target.value as AnalystStance)} className="mt-1 w-full">{Object.entries(STANCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Conviction · 0–100%<input name="analyst-view-conviction" autoComplete="off" value={model.draft.conviction} onChange={(event) => model.updateDraft("conviction", event.target.value)} type="number" min="0" max="100" inputMode="decimal" className="mt-1 w-full" placeholder="Optional…" /></label>
      <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Evidence state<select value={model.draft.evidenceState} onChange={(event) => model.updateDraft("evidenceState", event.target.value as AnalystEvidenceState)} className="mt-1 w-full"><option value="supported">Supported</option><option value="provisional">Provisional</option></select></label>
      <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Rationale<textarea value={model.draft.rationale} onChange={(event) => model.updateDraft("rationale", event.target.value)} rows={4} maxLength={50_000} className="mt-1 w-full" placeholder="Your defensible credit view…" /></label>
      {model.draft.evidenceState === "provisional" ? <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-warning">Unresolved items · one per line<textarea value={model.draft.unresolved} onChange={(event) => model.updateDraft("unresolved", event.target.value)} rows={2} className="mt-1 w-full" placeholder="Confirm latest liquidity…" /></label> : null}
    </>
  );
}

function AnalystViewContent({ model }: { model: AnalystViewModel }) {
  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <p className="m-0 tabular text-caos-xs text-caos-muted">System view {model.props.systemStance ? `· ${model.props.systemStance}` : "unavailable"}. Your view is separately versioned; detailed working notes remain in Analyst notes.</p>
      {model.loading ? <p className="m-0 tabular text-caos-xs text-caos-muted">Loading current analyst view…</p> : null}
      {model.error ? <p className="m-0 flex gap-1.5 tabular text-caos-xs text-caos-warning" role="alert"><StatusGlyph kind="warning" size={10} />{model.error}</p> : null}
      <CurrentAnalystView model={model} />
      <AnalystViewFields model={model} />
      <button type="button" className="caos-action-primary focus-ring self-start" onClick={() => void model.submit()} disabled={!canSubmitOpinion(model.draft, model.saving)}>{model.saving ? "Saving…" : model.current ? "Publish new version" : "Publish analyst view"}</button>
    </div>
  );
}

export function AnalystViewPanel(props: AnalystViewPanelProps) {
  const model = useAnalystViewModel(props);
  return <Panel title="Analyst view" right={model.current ? <span className="tabular text-caos-2xs text-caos-muted">v{model.current.version} · append-only</span> : null}><AnalystViewContent model={model} /></Panel>;
}
