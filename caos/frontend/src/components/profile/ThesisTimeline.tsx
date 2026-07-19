"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Panel } from "@/components/shared/Panel";
import { ActionReason } from "@/components/shared/ActionReason";
import { createThesisVersion, getThesisVersions, realizeThesisPrediction, type ThesisPrediction, type ThesisVersion } from "@/lib/api";

function PredictionRow({ prediction }: { prediction: ThesisPrediction }) {
  const [realized, setRealized] = useState<number | null>(prediction.realized);
  const [draft, setDraft] = useState("");
  return (
    <div className="contents">
      <span className="text-caos-text">{prediction.metric}</span>
      <span className="text-caos-muted">{prediction.horizon}</span>
      <span className="text-caos-text">{prediction.predicted}</span>
      {realized != null ? <span className="text-caos-text">{realized}</span> : (
        <span className="flex gap-1">
          <input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Realized ${prediction.metric}`} className="w-16 rounded border border-caos-border bg-caos-bg px-1 text-caos-text focus-ring" />
          <ActionReason reason={!draft || !Number.isFinite(Number(draft)) ? "Enter a valid number" : null} onClick={async () => setRealized((await realizeThesisPrediction(prediction.id, Number(draft))).realized)} className="rounded border border-caos-border px-1 text-caos-muted aria-disabled:opacity-40 focus-ring">SET</ActionReason>
        </span>
      )}
    </div>
  );
}

function ThesisEditor({
  draft,
  metric,
  horizon,
  predicted,
  busy,
  setDraft,
  setMetric,
  setHorizon,
  setPredicted,
  onSave,
}: {
  draft: string;
  metric: string;
  horizon: string;
  predicted: string;
  busy: boolean;
  setDraft: (value: string) => void;
  setMetric: (value: string) => void;
  setHorizon: (value: string) => void;
  setPredicted: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="pt-2 border-t border-caos-border flex flex-col gap-1.5">
      <label htmlFor="new-thesis-version" className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">New thesis version</label>
      <textarea id="new-thesis-version" value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} maxLength={50_000} className="rounded border border-caos-border bg-caos-bg p-2 text-caos-sm text-caos-text focus-ring" />
      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
        <input value={metric} onChange={(event) => setMetric(event.target.value)} placeholder="Prediction metric (optional)" aria-label="Prediction metric" className="rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring" />
        <input type="date" value={horizon} onChange={(event) => setHorizon(event.target.value)} aria-label="Prediction horizon" className="rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring" />
        <input type="number" value={predicted} onChange={(event) => setPredicted(event.target.value)} placeholder="Predicted" aria-label="Predicted value" className="w-24 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring" />
      </div>
      <ActionReason onClick={onSave} reason={busy ? "Saving…" : !draft.trim() ? "Enter thesis text first" : null} className="self-end tabular text-caos-2xs min-h-8 px-2 rounded bg-caos-accent text-caos-bg aria-disabled:opacity-40 focus-ring">{busy ? "SAVING…" : "SAVE VERSION"}</ActionReason>
    </div>
  );
}

function ThesisVersionRow({ version, open }: { version: ThesisVersion; open: boolean }) {
  return (
    <details className="py-2" open={open}>
      <summary className="cursor-pointer focus-ring rounded flex items-center gap-2">
        <span className="tabular text-caos-xs text-caos-text">V{version.version}</span>
        <span className="tabular text-caos-2xs text-caos-muted">{version.trigger.toUpperCase()} · {new Date(version.created_at).toLocaleDateString("en-CA")}</span>
      </summary>
      <div className="mt-1.5 text-caos-sm text-caos-text/90 whitespace-pre-wrap leading-relaxed">{version.thesis_md}</div>
      {version.predictions.length ? (
        <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 tabular text-caos-2xs">
          <span className="text-caos-muted">METRIC</span><span className="text-caos-muted">HORIZON</span><span className="text-caos-muted">PREDICTED</span><span className="text-caos-muted">REALIZED</span>
          {version.predictions.map((prediction) => <PredictionRow key={prediction.id} prediction={prediction} />)}
        </div>
      ) : null}
    </details>
  );
}

function ThesisHistory({ versions, error, onRetry }: { versions: ThesisVersion[]; error: boolean; onRetry: () => void }) {
  return (
    <div className="pt-2 border-t border-caos-border flex flex-col divide-y divide-caos-border/50">
      {error ? <div role="alert" className="py-2 tabular text-caos-xs" style={{ color: "var(--caos-critical)" }}>Couldn’t load thesis history. <button type="button" onClick={onRetry} className="underline focus-ring">Retry</button></div> : null}
      {!error && versions.length === 0 ? <div className="py-2 text-caos-xs text-caos-muted">No thesis version captured yet.</div> : null}
      {versions.map((version) => <ThesisVersionRow key={version.id} version={version} open={version.version === versions[0]?.version} />)}
    </div>
  );
}

export function ThesisTimeline({ issuerId, children }: { issuerId: string; children?: ReactNode }) {
  const [versions, setVersions] = useState<ThesisVersion[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [metric, setMetric] = useState("");
  const [horizon, setHorizon] = useState("");
  const [predicted, setPredicted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => getThesisVersions(issuerId).then((rows) => { setVersions(rows); setError(false); }).catch(() => setError(true)), [issuerId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const hasPrediction = metric.trim() && horizon && predicted && Number.isFinite(Number(predicted));
      const row = await createThesisVersion({
        issuer_id: issuerId, thesis_md: draft.trim(), trigger: "manual",
        predictions: hasPrediction ? [{ metric: metric.trim(), horizon, predicted: Number(predicted) }] : [],
      });
      setVersions((current) => [row, ...current]);
      setDraft(""); setMetric(""); setHorizon(""); setPredicted(""); setEditing(false); setError(false);
    } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <Panel
      title="Thesis & key drivers · memory"
      right={<button type="button" onClick={() => setEditing((value) => !value)} className="tabular text-caos-2xs min-h-7 px-2 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring">{editing ? "CANCEL" : "+ VERSION"}</button>}
    >
      <div className="px-3 py-2 flex flex-col gap-2">
        {children}
        {editing ? <ThesisEditor draft={draft} metric={metric} horizon={horizon} predicted={predicted} busy={busy} setDraft={setDraft} setMetric={setMetric} setHorizon={setHorizon} setPredicted={setPredicted} onSave={save} /> : null}
        <ThesisHistory versions={versions} error={error} onRetry={load} />
      </div>
    </Panel>
  );
}
