"use client";

// Sector Review's per-signal detail panel (P2-WP-7). The row is a single
// click target (Sam's red-flag: one click target per row, no nested
// interactive controls inside the list item) that opens this instead —
// everything the old inline signal card used to show (summary, issuers,
// sources, provenance, Ask Topic) now lives here on the shared SlideOver
// primitive.

import { IssuerLink } from "@/components/shared/IssuerLink";
import { SlideOver } from "@/components/shared/SlideOver";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import type { SectorSignal } from "@/lib/api";
import { CATEGORY_LABEL, SEVERITY_COLOR, SEVERITY_GLYPH, SourceChip, ProvenanceBadge, fmtAsOf } from "./shared";

export function SignalSlideOver({
  signal,
  onClose,
  onAskTopic,
}: {
  signal: SectorSignal;
  onClose: () => void;
  onAskTopic: (signal: SectorSignal) => void;
}) {
  return (
    <SlideOver title={signal.headline} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded border border-caos-border px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider"
            style={{ color: SEVERITY_COLOR[signal.severity] || "var(--caos-muted)" }}
          >
            <StatusGlyph kind={SEVERITY_GLYPH[signal.severity] || "idle"} size={8} />
            {signal.severity}
          </span>
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
            {CATEGORY_LABEL[signal.category] || signal.category} / {signal.sector}
          </span>
          <ProvenanceBadge value={signal.provenance} />
        </div>

        <p className="m-0 text-caos-sm leading-relaxed text-caos-text">{signal.summary}</p>

        <div className="flex items-center gap-3 tabular text-caos-2xs uppercase tracking-wider text-caos-muted border-y border-caos-border/60 py-1.5">
          <span>Score {Math.round(signal.materiality_score * 100)}</span>
          <span>{fmtAsOf.format(new Date(signal.signal_date))}</span>
          <span>Confidence {signal.confidence}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Issuers</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {signal.issuers.map((issuer) => (
              <IssuerLink
                key={`${signal.id}-${issuer.name}`}
                issuer={issuer.issuer_id ? { id: issuer.issuer_id } : undefined}
                query={issuer.issuer_id ? undefined : issuer.name}
                className="rounded border border-caos-border px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider text-caos-accent hover:text-caos-text hover:border-caos-accent transition-caos"
              >
                {issuer.ticker || issuer.name} / {issuer.exposure}
              </IssuerLink>
            ))}
            {!signal.issuers.length ? <span className="text-caos-xs text-caos-muted">No linked issuers.</span> : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Sources</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {signal.sources.map((source) => (
              <SourceChip key={`${signal.id}-${source.ref}`} source={source} />
            ))}
            {!signal.sources.length ? <span className="text-caos-xs text-caos-muted">No cited sources.</span> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAskTopic(signal)}
          className="self-start rounded border border-caos-border px-2.5 py-1.5 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:border-caos-accent hover:text-caos-text transition-caos focus-ring caos-target"
        >
          Ask Topic
        </button>
      </div>
    </SlideOver>
  );
}
