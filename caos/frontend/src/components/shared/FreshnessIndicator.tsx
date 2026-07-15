import { StatusGlyph } from "./StatusGlyph";
import { FRESHNESS_VIEW, freshnessDetail } from "@/lib/freshness";
import type { FreshnessEvaluation } from "@/lib/api";

export function FreshnessIndicator({ evaluation, className = "" }: { evaluation: FreshnessEvaluation | null | undefined; className?: string }) {
  if (!evaluation) {
    return <span className={`inline-flex items-center gap-1 tabular text-caos-2xs uppercase ${className}`} style={{ color: "var(--caos-muted)" }} aria-label="Freshness unknown; central evaluation unavailable" title="Central freshness evaluation unavailable"><StatusGlyph kind="idle" />UNKNOWN</span>;
  }
  const view = FRESHNESS_VIEW[evaluation.state];
  const detail = freshnessDetail(evaluation);
  return <span className={`inline-flex items-center gap-1 tabular text-caos-2xs uppercase ${className}`} style={{ color: view.color }} aria-label={`Freshness ${view.label}; ${detail}`} title={detail}><StatusGlyph kind={view.glyph} />{view.label}</span>;
}
