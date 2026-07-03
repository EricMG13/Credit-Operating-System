"use client";

// The permanent right column: the "show your work" payoff of Query. With no
// selection it carries the answer's caveats and meta (the honest small print);
// with a node selected it becomes that node's evidence card — description,
// detail, analyst excerpt, source-chunk jump, confidence, and a Deep-Dive jump
// for issuer nodes. Rendered as a fixed column ≥lg and as a slide-over below
// (selection must always land somewhere visible — never a silent no-op).

import type { GraphNode, GraphResult, OverlayEdge, OverlayResult } from "@/lib/query/graph";
import { pairKey } from "@/lib/query/graph";
import { CloseButton } from "@/components/shared/CloseButton";
import { QUESTIONS } from "@/lib/query/questions";
import { MODEL_HUE } from "@/components/query/node-style";

type OpenChunk = (chunkId: string, label?: string | null) => void;

export function EvidenceDock({
  graph,
  node,
  overlay,
  acceptedPairs,
  onClear,
  onOpenChunk,
  onPickWalk,
  onAcceptLink,
  onRetractLink,
}: {
  graph: GraphResult | null;
  node: GraphNode | null;
  overlay?: OverlayResult | null;
  acceptedPairs?: Map<string, string>; // pairKey → link id (ratified state)
  onClear: () => void;
  onOpenChunk: OpenChunk;
  onPickWalk?: (capabilityId: string) => void;
  onAcceptLink?: (edge: OverlayEdge) => void;
  onRetractLink?: (linkId: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
      {node ? (
        <NodeCard node={node} onClear={onClear} onOpenChunk={onOpenChunk} />
      ) : (
        <>
          <AnswerNotes graph={graph} />
          {overlay && (
            <ModelCommentary
              overlay={overlay}
              graph={graph}
              acceptedPairs={acceptedPairs}
              onOpenChunk={onOpenChunk}
              onPickWalk={onPickWalk}
              onAcceptLink={onAcceptLink}
              onRetractLink={onRetractLink}
            />
          )}
        </>
      )}
    </div>
  );
}

// The model half of the hybrid — visually and structurally its own provenance
// class: purple, labeled, stamped with model id + timestamp, excluded from print.
function ModelCommentary({
  overlay,
  graph,
  acceptedPairs,
  onOpenChunk,
  onPickWalk,
  onAcceptLink,
  onRetractLink,
}: {
  overlay: OverlayResult;
  graph?: GraphResult | null;
  acceptedPairs?: Map<string, string>;
  onOpenChunk: OpenChunk;
  onPickWalk?: (capabilityId: string) => void;
  onAcceptLink?: (edge: OverlayEdge) => void;
  onRetractLink?: (linkId: string) => void;
}) {
  // Only issuer↔issuer proposals are ratifiable — run-scoped nodes (claims,
  // modules) have no stable identity across runs.
  const issuerIds = new Set(
    (graph?.nodes ?? []).filter((n) => n.kind === "issuer" || n.kind === "center").map((n) => n.id)
  );
  return (
    <div className="p-4 pt-0 flex flex-col gap-3 print:hidden" data-testid="model-commentary">
      <div className="border-t border-caos-border pt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="tabular text-caos-3xs uppercase tracking-wider font-mono px-1.5 py-px rounded border" style={{ color: MODEL_HUE, borderColor: `${MODEL_HUE}88`, backgroundColor: `${MODEL_HUE}15` }}>
            Model commentary
          </span>
          <span className="tabular text-caos-3xs text-caos-muted font-mono truncate">
            {overlay.model ?? "unavailable"}{overlay.cached ? " · cached" : ""}
          </span>
        </div>
        {overlay.created_at && (
          <div className="tabular text-caos-3xs text-caos-muted font-mono mt-0.5">{overlay.created_at}</div>
        )}
      </div>

      {overlay.commentary && (
        <div className="text-caos-sm text-caos-text leading-relaxed font-sans border-l-2 pl-2.5" style={{ borderColor: `${MODEL_HUE}66` }}>
          {overlay.commentary}
        </div>
      )}

      {overlay.edges.length > 0 && (
        <div>
          <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1">
            Proposed links ({overlay.edges.length}) — model-proposed, cite-gated
          </div>
          <ul className="flex flex-col gap-2">
            {overlay.edges.map((e, i) => {
              const ratifiable = issuerIds.has(e.source) && issuerIds.has(e.target);
              const linkId = acceptedPairs?.get(pairKey(e.source, e.target));
              return (
                <li key={i} className="text-caos-2xs font-mono leading-normal border border-caos-border rounded p-2 bg-caos-bg/50">
                  <div className="text-caos-text">
                    {e.source} ⇢ {e.target}
                    <span className="text-caos-muted"> · {e.confidence}</span>
                  </div>
                  {e.rationale && <div className="text-caos-muted mt-0.5 font-sans text-caos-xs">{e.rationale}</div>}
                  <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                    {e.chunk_ids.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onOpenChunk(c)}
                        className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
                      >
                        src {c.slice(0, 8)}
                      </button>
                    ))}
                    {ratifiable && !linkId && onAcceptLink && (
                      <button
                        type="button"
                        onClick={() => onAcceptLink(e)}
                        title="Ratify this link — it becomes stored, analyst-attributed graph data"
                        className="ml-auto tabular text-caos-3xs font-semibold px-1.5 py-0.5 rounded border transition-caos focus-ring"
                        style={{ color: MODEL_HUE, borderColor: `${MODEL_HUE}88` }}
                      >
                        ACCEPT
                      </button>
                    )}
                    {ratifiable && linkId && onRetractLink && (
                      <span className="ml-auto inline-flex items-center gap-1.5">
                        <span className="tabular text-caos-3xs" style={{ color: MODEL_HUE }}>✓ accepted</span>
                        <button
                          type="button"
                          onClick={() => onRetractLink(linkId)}
                          className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring"
                        >
                          UNDO
                        </button>
                      </span>
                    )}
                    {!ratifiable && (
                      <span
                        className="ml-auto tabular text-caos-3xs text-caos-muted"
                        title="Only issuer↔issuer links can be ratified — run-scoped nodes have no stable identity"
                      >
                        view-only
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {overlay.suggested_walks.length > 0 && onPickWalk && (
        <div>
          <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1">Suggested next walks</div>
          <div className="flex gap-1.5 flex-wrap">
            {overlay.suggested_walks.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onPickWalk(w)}
                className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
              >
                {QUESTIONS[w]?.q ?? w}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tabular text-caos-3xs text-caos-muted font-mono leading-normal">
        Model output — not engine-derived. Excluded from print and CSV.
      </div>
    </div>
  );
}

function AnswerNotes({ graph }: { graph: GraphResult | null }) {
  if (!graph) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <div className="tabular text-caos-xs font-mono uppercase tracking-wider text-caos-text mb-1">Evidence</div>
        <div className="text-caos-2xs text-caos-muted font-mono max-w-xs leading-normal">
          Run a question, then select a node to inspect its grounding.
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1">Scope</div>
        <div className="flex flex-col gap-1">
          {graph.meta.map((m, i) => (
            <span key={i} className="tabular text-caos-2xs text-caos-text font-mono border border-caos-border rounded px-1.5 py-1 bg-caos-bg">
              {m}
            </span>
          ))}
        </div>
      </div>
      {graph.caveats.length > 0 && (
        <div>
          <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-warning mb-1 flex items-center gap-1">
            <span aria-hidden>!</span> Caveats
          </div>
          <ul className="flex flex-col gap-1.5">
            {graph.caveats.map((c, i) => (
              <li key={i} className="text-caos-2xs text-caos-muted font-mono leading-normal border-l-2 border-caos-warning/40 pl-2">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-caos-2xs text-caos-muted font-mono leading-normal">
        Select a node to inspect its grounding evidence.
      </div>
    </div>
  );
}

function NodeCard({ node, onClear, onOpenChunk }: { node: GraphNode; onClear: () => void; onOpenChunk: OpenChunk }) {
  const isIssuer = node.kind === "issuer" || node.kind === "center";
  return (
    <>
      <div className="p-4 flex items-start justify-between border-b border-caos-border bg-caos-elevated/35 shrink-0">
        <div className="min-w-0">
          <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-accent font-mono">
            {node.kind.replace("-", " ")}
          </span>
          <h2 className="tabular text-caos-md font-mono text-caos-text mt-0.5 leading-snug break-words">
            {node.label}
          </h2>
        </div>
        <CloseButton onClick={onClear} title="Clear selection" />
      </div>

      <div className="flex flex-col gap-3 p-4">
        {node.sub && (
          <div>
            <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Description</div>
            <div className="text-caos-sm text-caos-text leading-relaxed font-sans">{node.sub}</div>
          </div>
        )}

        {node.title && (
          <div>
            <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Detail</div>
            <div className="text-caos-xs text-caos-text/90 leading-relaxed bg-caos-bg/50 border border-caos-border rounded p-2.5 font-mono whitespace-pre-wrap">
              {node.title}
            </div>
          </div>
        )}

        {node.analyst_excerpt && (
          <div>
            <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Analyst excerpt</div>
            <blockquote className="text-caos-xs text-caos-text/90 leading-relaxed border-l-2 border-caos-accent/50 pl-2.5 font-sans">
              {node.analyst_excerpt}
            </blockquote>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {node.group && node.group !== node.sub && (
            <span className="tabular text-caos-2xs text-caos-text bg-caos-bg border border-caos-border rounded px-1.5 py-0.5">
              {node.group}
            </span>
          )}
          {node.confidence && (
            <span
              className="tabular text-caos-2xs font-semibold px-2 py-0.5 rounded border"
              style={{
                color: node.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)",
                borderColor: (node.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") + "55",
                backgroundColor: (node.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") + "11",
              }}
            >
              {node.confidence} confidence
            </span>
          )}
          {typeof node.weight === "number" && (
            <span className="tabular text-caos-2xs text-caos-muted font-mono border border-caos-border rounded px-1.5 py-0.5">
              w {node.weight}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 pt-0 flex flex-col gap-2 shrink-0">
        {node.chunk_id && (
          <button
            type="button"
            onClick={() => onOpenChunk(node.chunk_id!, node.label)}
            className="w-full tabular text-caos-xs font-semibold py-2 px-3 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
          >
            OPEN SOURCE CHUNK
          </button>
        )}
        {isIssuer && (
          <a
            href={`/deepdive?issuer=${encodeURIComponent(node.id)}`}
            className="w-full flex items-center justify-center gap-1.5 tabular text-caos-xs font-semibold py-2 px-3 rounded bg-caos-accent text-caos-bg hover:opacity-90 transition-caos focus-ring"
          >
            <span>OPEN IN DEEP-DIVE</span>
            <span aria-hidden className="text-caos-2xs">↗</span>
          </a>
        )}
        {node.obsidian_url && (
          <a
            href={node.obsidian_url}
            className="w-full flex items-center justify-center gap-1.5 tabular text-caos-xs font-semibold py-2 px-3 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
          >
            <span>REVEAL IN WIKI</span>
            <span aria-hidden className="text-caos-2xs">↗</span>
          </a>
        )}
      </div>
    </>
  );
}
