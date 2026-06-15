"use client";

// Click-to-source: a lightweight modal that fetches and shows one ingested
// document chunk behind a citation chip (the `src` / E-xx markers in the
// cross-issuer query results). Esc / ✕ / backdrop to close.

import { useEffect, useState } from "react";
import { getChunk } from "@/lib/api";
import type { ChunkDTO } from "@/lib/query/types";
import { StatusGlyph } from "@/components/shared/StatusGlyph";

export function CitationViewer({ chunkId, label, onClose }: { chunkId: string; label?: string | null; onClose: () => void }) {
  const [chunk, setChunk] = useState<ChunkDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChunk(null);
    setErr(null);
    getChunk(chunkId)
      .then((c) => { if (!cancelled) setChunk(c); })
      .catch((e) => {
        if (!cancelled) {
          const d = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
            || (e as Error)?.message || "could not load source";
          setErr(String(d));
        }
      });
    return () => { cancelled = true; };
  }, [chunkId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 caos-enter"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] max-h-[80vh] flex flex-col bg-caos-panel border border-caos-accent/50 rounded-md overflow-hidden"
        style={{ boxShadow: "0 24px 72px -16px rgba(0,0,0,0.9)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Source document chunk"
      >
        <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70">
          <span className="text-caos-accent text-[11px]">❝</span>
          <span className="tabular text-[10px] uppercase tracking-wider text-caos-muted">Source</span>
          {label ? <span className="tabular text-[9px] px-1.5 py-px rounded border border-caos-accent/50 text-caos-accent">{label}</span> : null}
          <div className="flex-1" />
          <button
            onClick={onClose}
            aria-label="Close source viewer"
            className="w-5 h-5 rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-[10px] focus-ring"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-3.5 py-3">
          {err ? (
            <div className="tabular text-[10px]" style={{ color: "var(--caos-warning)" }}><StatusGlyph kind="warning" /> {err}</div>
          ) : !chunk ? (
            <div className="tabular text-[10px] text-caos-muted">Loading source…</div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-caos-text font-medium">{chunk.issuer_name}</span>
                <span className="tabular text-[8.5px] uppercase tracking-wide px-1.5 py-px rounded border border-caos-border text-caos-muted">{chunk.doc_type}</span>
                <span className="tabular text-[9px] text-caos-muted">{chunk.doc}</span>
              </div>
              <div className="text-[11px] text-caos-text/90 leading-relaxed whitespace-pre-wrap border-l-2 border-caos-accent/40 pl-2.5">
                {chunk.text}
              </div>
              <div className="tabular text-[8px] uppercase tracking-wide text-caos-muted">
                chunk {chunk.chunk_id.slice(0, 8)} · seq {chunk.seq}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
