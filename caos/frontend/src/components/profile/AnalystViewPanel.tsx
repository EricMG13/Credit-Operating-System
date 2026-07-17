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

export function AnalystViewPanel({
  issuerId,
  systemStance,
  sourceRunId,
  contextId,
}: {
  issuerId: string;
  systemStance?: string | null;
  sourceRunId?: string | null;
  contextId?: string | null;
}) {
  const [history, setHistory] = useState<AnalystOpinionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stance, setStance] = useState<AnalystStance>("NEUTRAL");
  const [conviction, setConviction] = useState("");
  const [evidenceState, setEvidenceState] = useState<AnalystEvidenceState>("supported");
  const [rationale, setRationale] = useState("");
  const [unresolved, setUnresolved] = useState("");

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    analystOpinionsApi.list(issuerId)
      .then((next) => {
        if (stale) return;
        setHistory(next);
        if (next.current) {
          setStance(next.current.stance);
          setConviction(next.current.conviction == null ? "" : String(next.current.conviction));
          setEvidenceState(next.current.evidence_state);
          setRationale(next.current.rationale_md);
          setUnresolved(next.current.unresolved_items.join("\n"));
        }
      })
      .catch((reason) => !stale && setError(toErrorMessage(reason, "Analyst view unavailable.")))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [issuerId]);

  const current = history?.current ?? null;
  const divergence = current && !sameStance(systemStance, current.stance);
  const submit = async () => {
    const gaps = unresolved.split("\n").map((item) => item.trim()).filter(Boolean);
    if (!rationale.trim() || saving || (evidenceState === "provisional" && gaps.length === 0)) return;
    const parsedConviction = conviction.trim() === "" ? null : Number(conviction);
    if (parsedConviction != null && (!Number.isFinite(parsedConviction) || parsedConviction < 0 || parsedConviction > 100)) {
      setError("Conviction must be a finite percentage from 0 to 100.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const opinion = await analystOpinionsApi.create(issuerId, {
        stance,
        conviction: parsedConviction,
        rationale_md: rationale.trim(),
        evidence_state: evidenceState,
        unresolved_items: gaps,
        source_run_id: sourceRunId ?? null,
        context_id: contextId ?? null,
      });
      setHistory((previous) => ({ current: opinion, items: [opinion, ...(previous?.items ?? [])] }));
    } catch (reason) {
      setError(toErrorMessage(reason, "Analyst view could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Analyst view"
      right={current ? <span className="tabular text-caos-2xs text-caos-muted">v{current.version} · append-only</span> : null}
    >
      <div className="px-3 py-2 flex flex-col gap-2">
        <p className="m-0 tabular text-caos-xs text-caos-muted">
          System view {systemStance ? `· ${systemStance}` : "unavailable"}. Your view is separately versioned; detailed working notes remain in Analyst notes.
        </p>
        {loading ? <p className="m-0 tabular text-caos-xs text-caos-muted">Loading current analyst view…</p> : null}
        {error ? <p className="m-0 flex gap-1.5 tabular text-caos-xs text-caos-warning" role="alert"><StatusGlyph kind="warning" size={10} />{error}</p> : null}
        {current ? (
          <div className="border-y border-caos-border/40 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular text-caos-xs font-semibold text-caos-text">{STANCE_LABEL[current.stance]}{current.conviction != null ? ` · ${current.conviction}%` : ""}</span>
              <span className={"tabular text-caos-2xs uppercase tracking-wider " + (divergence ? "text-caos-warning" : "text-caos-success")}>{divergence ? "Differs from system" : "Aligned with system"}</span>
            </div>
            <p className="m-0 mt-1 tabular text-caos-xs text-caos-muted">{current.evidence_state}{current.unresolved_items.length ? ` · ${current.unresolved_items.length} unresolved` : ""}</p>
          </div>
        ) : null}
        <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Stance
          <select value={stance} onChange={(event) => setStance(event.target.value as AnalystStance)} className="mt-1 w-full">
            {Object.entries(STANCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Conviction · 0–100%
          <input value={conviction} onChange={(event) => setConviction(event.target.value)} type="number" min="0" max="100" inputMode="decimal" className="mt-1 w-full" placeholder="Optional" />
        </label>
        <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Evidence state
          <select value={evidenceState} onChange={(event) => setEvidenceState(event.target.value as AnalystEvidenceState)} className="mt-1 w-full">
            <option value="supported">Supported</option>
            <option value="provisional">Provisional</option>
          </select>
        </label>
        <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Rationale
          <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={4} maxLength={50_000} className="mt-1 w-full" placeholder="Your defensible credit view…" />
        </label>
        {evidenceState === "provisional" ? <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-warning">Unresolved items · one per line
          <textarea value={unresolved} onChange={(event) => setUnresolved(event.target.value)} rows={2} className="mt-1 w-full" placeholder="Confirm latest liquidity…" />
        </label> : null}
        <button type="button" className="caos-action-primary focus-ring self-start" onClick={submit} disabled={saving || !rationale.trim() || (evidenceState === "provisional" && !unresolved.trim())}>
          {saving ? "Saving…" : current ? "Publish new version" : "Publish analyst view"}
        </button>
      </div>
    </Panel>
  );
}
