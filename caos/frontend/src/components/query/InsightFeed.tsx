"use client";

// The Desk Brief — the proactive AI-research surface for Query. Cited, AI-written
// insight cards over what changed in the book, rendered the moment the analyst
// opens the concept (no prompting). Everything here is grounded server-side: a
// card that cites nothing real, or states a number its evidence doesn't support,
// never reaches this component. The whole band is marked AI-GENERATED (MODEL_HUE)
// and is display:none in print (committee exhibits carry ratified data, not
// working AI notes).

import { useMemo } from "react";
import type { InsightBrief, InsightCard } from "@/lib/query/graph";
import { MODEL_HUE } from "@/components/query/node-style";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";

// A short scannable tag derived from the card's first cited evidence id — the
// pack id namespace (delta:/f:/coverage/docs) tells us what kind of signal it is,
// so no extra backend field is needed. Color is signal, paired with the label.
function cardTag(card: InsightCard): { label: string; color: string } {
  const id = card.evidence[0]?.id ?? "";
  if (id.startsWith("delta:")) return { label: "MOVE", color: "var(--caos-accent)" };
  if (id.startsWith("f:")) return { label: "QA FLAG", color: "var(--caos-warning)" };
  if (id.startsWith("coverage")) return { label: "COVERAGE", color: "var(--caos-muted)" };
  if (id.startsWith("docs")) return { label: "DOCS", color: "var(--caos-muted)" };
  return { label: "INSIGHT", color: "var(--caos-muted)" };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

interface Props {
  brief: InsightBrief | null;
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onOpenWalk: (walk: string) => void;
  onOpenChunk: (chunkId: string, label?: string) => void;
  onPin?: (card: InsightCard) => void;
}

export function InsightFeed({
  brief, loading, collapsed, onToggle, onRefresh, onOpenWalk, onOpenChunk, onPin,
}: Props) {
  const cards = brief?.cards ?? [];
  const degraded = brief?.degraded ?? false;
  const refreshing = brief?.refreshing ?? false;
  const marking = useMemo(() => (degraded ? null : MODEL_HUE), [degraded]);

  // Model lane off → the panel has no place on the surface (the deterministic
  // walks carry the whole experience). Render nothing rather than an empty band.
  if (brief && !brief.available && cards.length === 0) return null;

  return (
    <section
      className="shrink-0 border-b border-caos-border bg-caos-panel/40 print:hidden"
      aria-label="Desk brief"
    >
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-caos-muted hover:text-caos-text transition-caos focus-ring rounded"
        >
          <svg
            viewBox="0 0 12 12" aria-hidden
            className={`w-2.5 h-2.5 stroke-current transition-transform ${collapsed ? "" : "rotate-90"}`}
            fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M4 2.5 L8 6 L4 9.5" />
          </svg>
          <span
            className="w-3.5 h-3.5 shrink-0 rounded-sm flex items-center justify-center"
            style={{ border: `1px solid ${marking ?? "var(--caos-border)"}`, background: marking ? `${MODEL_HUE}18` : "transparent" }}
            aria-hidden
          >
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke={marking ?? "var(--caos-muted)"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1.5 L7 4.8 L10.3 6 L7 7.2 L6 10.5 L5 7.2 L1.7 6 L5 4.8 Z" />
            </svg>
          </span>
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-text font-semibold">Desk Brief</span>
        </button>

        {/* Shared grammar (P2-WP-4) replaces the bespoke purple "AI-Generated"/
            "Deterministic" chip — both states are real coverage-DB data
            (origin LIVE); method is the only axis that differs. */}
        <ProvenanceChip
          prov={{
            origin: "LIVE",
            method: marking ? "MODELLED" : "DERIVED",
            detail: marking
              ? "Model-written, grounded in the coverage database — one click from its evidence"
              : "Deterministic highlights — the model lane returned nothing groundable",
          }}
        />

        {cards.length > 0 && (
          <span className="tabular text-caos-3xs text-caos-muted font-mono">{cards.length} {cards.length === 1 ? "card" : "cards"}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {refreshing || loading ? (
            <span className="tabular text-caos-3xs text-caos-accent flex items-center gap-1">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-caos-accent caos-running" />
              building
            </span>
          ) : brief ? (
            <span className="tabular text-caos-3xs text-caos-muted font-mono truncate max-w-[40vw]" title={brief.model ?? undefined}>
              {brief.model ? `${brief.model.split("/").pop()} · ` : ""}{timeAgo(brief.generated_at)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="tabular text-caos-3xs uppercase tracking-wider px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 disabled:opacity-40 disabled:cursor-wait transition-caos focus-ring"
            title="Rebuild the brief from the latest data"
          >
            Refresh
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-3">
          {degraded && brief?.generated_reason && (
            <p className="tabular text-caos-3xs text-caos-muted font-mono mb-2">{brief.generated_reason}</p>
          )}
          {cards.length === 0 ? (
            <p className="tabular text-caos-xs text-caos-muted py-2">
              {loading || refreshing ? "Reading what changed across the book…" : "No changes to surface yet."}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <Card key={card.id} card={card} accent={marking} onOpenWalk={onOpenWalk} onOpenChunk={onOpenChunk} onPin={onPin} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Card({
  card, accent, onOpenWalk, onOpenChunk, onPin,
}: {
  card: InsightCard;
  accent: string | null;
  onOpenWalk: (walk: string) => void;
  onOpenChunk: (chunkId: string, label?: string) => void;
  onPin?: (card: InsightCard) => void;
}) {
  const tag = cardTag(card);
  return (
    <article
      className="flex flex-col gap-1.5 rounded-md border border-caos-border bg-caos-bg p-2.5 transition-caos hover:border-caos-elevated"
      style={accent ? { borderLeft: `2px solid ${accent}` } : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span className="tabular text-caos-3xs uppercase tracking-wider font-mono" style={{ color: tag.color }}>{tag.label}</span>
      </div>
      <h3 className="text-caos-sm text-caos-text font-medium font-sans leading-snug">{card.headline}</h3>
      {card.detail && (
        <p className="text-caos-xs text-caos-muted font-sans leading-relaxed">{card.detail}</p>
      )}
      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
        {card.evidence.map((e) =>
          e.chunk_id ? (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpenChunk(e.chunk_id as string, e.label)}
              className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring truncate max-w-[60%]"
              title={`Open source — ${e.label}`}
            >
              {e.label}
            </button>
          ) : (
            <span key={e.id} className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border/60 text-caos-muted truncate max-w-[60%]" title={e.label}>
              {e.label}
            </span>
          ),
        )}
        <div className="ml-auto flex items-center gap-2">
          {onPin && (
            <button
              type="button"
              onClick={() => onPin(card)}
              className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted hover:text-caos-text transition-caos focus-ring rounded"
              title="Pin this insight into the report"
            >
              + Report
            </button>
          )}
          {card.walk && (
            <button
              type="button"
              onClick={() => onOpenWalk(card.walk as string)}
              className="tabular text-caos-3xs uppercase tracking-wider text-caos-accent hover:underline transition-caos focus-ring rounded"
            >
              Open walk →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
