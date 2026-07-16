"use client";

interface ContextMutationState {
  mutationState: "idle" | "saving" | "error";
  mutationError: string | null;
  retryLastPatch: () => Promise<unknown>;
}

export function AnalysisContextSaveState({ analysis }: { analysis: ContextMutationState }) {
  if (analysis.mutationState === "saving") {
    return <span role="status" className="tabular text-caos-2xs text-caos-muted">Saving context…</span>;
  }
  if (analysis.mutationState !== "error") return null;
  return (
    <span role="alert" className="flex items-center gap-2 text-caos-xs text-caos-critical">
      <span>{analysis.mutationError ?? "Analysis context was not saved."}</span>
      <button
        type="button"
        className="tabular text-caos-2xs text-caos-accent focus-ring"
        onClick={() => void analysis.retryLastPatch().catch(() => undefined)}
      >
        Retry context save
      </button>
    </span>
  );
}
