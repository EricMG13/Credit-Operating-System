"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Panel } from "@/components/shared/Panel";
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
          <button type="button" disabled={!draft || !Number.isFinite(Number(draft))} onClick={async () => setRealized((await realizeThesisPrediction(prediction.id, Number(draft))).realized)} className="rounded border border-caos-border px-1 text-caos-muted disabled:opacity-40 focus-ring">SET</button>
        </span>
      )}
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
        {editing ? (
          <div className="pt-2 border-t border-caos-border flex flex-col gap-1.5">
            <label htmlFor="new-thesis-version" className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">New thesis version</label>
            <textarea id="new-thesis-version" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={50_000} className="rounded border border-caos-border bg-caos-bg p-2 text-caos-sm text-caos-text focus-ring" />
            <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
              <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="Prediction metric (optional)" aria-label="Prediction metric" className="rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring" />
              <input type="date" value={horizon} onChange={(e) => setHorizon(e.target.value)} aria-label="Prediction horizon" className="rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring" />
              <input type="number" value={predicted} onChange={(e) => setPredicted(e.target.value)} placeholder="Predicted" aria-label="Predicted value" className="w-24 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring" />
            </div>
            <button type="button" onClick={save} disabled={busy || !draft.trim()} className="self-end tabular text-caos-2xs min-h-8 px-2 rounded bg-caos-accent text-caos-bg disabled:opacity-40 focus-ring">{busy ? "SAVING…" : "SAVE VERSION"}</button>
          </div>
        ) : null}
        <div className="pt-2 border-t border-caos-border flex flex-col divide-y divide-caos-border/50">
          {error ? <div role="alert" className="py-2 tabular text-caos-xs" style={{ color: "var(--caos-critical)" }}>Couldn’t load thesis history. <button type="button" onClick={load} className="underline focus-ring">Retry</button></div> : null}
          {!error && versions.length === 0 ? <div className="py-2 text-caos-xs text-caos-muted">No thesis version captured yet.</div> : null}
          {versions.map((version) => (
            <details key={version.id} className="py-2" open={version.version === versions[0]?.version}>
              <summary className="cursor-pointer focus-ring rounded flex items-center gap-2">
                <span className="tabular text-caos-xs text-caos-text">V{version.version}</span>
                <span className="tabular text-caos-2xs text-caos-muted">{version.trigger.toUpperCase()} · {new Date(version.created_at).toLocaleDateString()}</span>
              </summary>
              <div className="mt-1.5 text-caos-sm text-caos-text/90 whitespace-pre-wrap leading-relaxed">{version.thesis_md}</div>
              {version.predictions.length ? (
                <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 tabular text-caos-2xs">
                  <span className="text-caos-muted">METRIC</span><span className="text-caos-muted">HORIZON</span><span className="text-caos-muted">PREDICTED</span><span className="text-caos-muted">REALIZED</span>
                  {version.predictions.map((prediction) => <PredictionRow key={prediction.id} prediction={prediction} />)}
                </div>
              ) : null}
            </details>
          ))}
        </div>
      </div>
    </Panel>
  );
}
