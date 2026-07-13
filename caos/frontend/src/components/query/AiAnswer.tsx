"use client";

// The grounded AI answer that sits under the deterministic synthesis line. Cited
// prose written from vault chunks (+ the walk graph); every sentence is
// sentence-gated server-side, so what renders here is grounded. Marked
// AI-GENERATED (MODEL_HUE), display:none in print — additive to, never a
// replacement for, the deterministic answer above it.

import type { AnswerResult } from "@/lib/query/graph";
import { MODEL_HUE } from "@/components/query/node-style";

interface Props {
  answer: AnswerResult | null;
  loading: boolean;
  onOpenChunk: (chunkId: string, label?: string) => void;
}

export function AiAnswer({ answer, loading, onOpenChunk }: Props) {
  if (!loading && !answer) return null;

  return (
    <div
      className="mt-2 rounded-md border bg-caos-bg/60 px-3 py-2 print:hidden"
      style={{ borderColor: `${MODEL_HUE}66`, backgroundColor: `${MODEL_HUE}0A` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="tabular text-caos-3xs uppercase tracking-wider font-semibold" style={{ color: MODEL_HUE }}>
          AI Answer
        </span>
        {loading ? (
          <span className="tabular text-caos-3xs text-caos-accent flex items-center gap-1">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-caos-accent caos-running" />
            reading sources
          </span>
        ) : answer?.model ? (
          <span className="tabular text-caos-3xs text-caos-muted font-mono truncate max-w-[45%]" title={answer.model}>
            {answer.model.split("/").pop()}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-caos-xs text-caos-muted font-sans">Grounding an answer in the vault…</p>
      ) : answer?.unavailable || !answer?.answer ? (
        <p className="text-caos-xs text-caos-muted font-sans">
          {answer?.reason || "No grounded answer — the vault sources don't cover this. The deterministic result above stands."}
        </p>
      ) : (
        <>
          <p className="text-caos-sm text-caos-text font-sans leading-relaxed">{answer.answer}</p>
          {answer.citations.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">Sources</span>
              {answer.citations.map((c) => (
                <button
                  key={c.chunk_id}
                  type="button"
                  onClick={() => onOpenChunk(c.chunk_id, c.label)}
                  className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring truncate max-w-[45%]"
                  title={`Open source — ${c.label}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
