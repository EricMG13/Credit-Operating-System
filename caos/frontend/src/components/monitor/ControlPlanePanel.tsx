"use client";

// Coverage Control Plane (WP-4 G14) — the ingestion-side counterpart to
// GovernancePanel's QA/gap/staleness categories: a vaulted document that
// quietly produced no usable text, or one that only ever produced lower-
// fidelity OCR-derived text. Both degrade silently in ingest.py today (a
// logged warning, then nothing else); this surfaces them as a real, live
// read over Document/DocumentChunk state instead of a document that just
// vanishes into "vaulted, contributes nothing" with no visibility anywhere.

import { useEffect, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import {
  getIngestionGaps,
  type CoverageOriginRow,
  type IngestionGapRow,
  type IngestionGapsResponse,
} from "@/lib/api";

function GapRow({ row, badge, badgeColor }: { row: IngestionGapRow; badge: string; badgeColor: string }) {
  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
          style={{ color: badgeColor, borderColor: `color-mix(in srgb, ${badgeColor} 40%, transparent)`, background: `color-mix(in srgb, ${badgeColor} 8%, transparent)` }}
        >
          {badge}
        </span>
        <IssuerLink
          issuer={{ id: row.issuer_id }}
          title={`Open ${row.issuer_name} profile`}
          className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
        >
          {row.issuer_name}
        </IssuerLink>
        <span className="tabular text-caos-sm text-caos-text truncate flex-1 min-w-0">{row.file_name}</span>
        <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap shrink-0">{row.doc_type}</span>
      </div>
      <div className="text-caos-xs text-caos-muted leading-snug mt-0.5">{row.detail}</div>
    </div>
  );
}

function Category({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">{title}</h3>
      {children}
    </div>
  );
}

function CoverageRow({ row }: { row: CoverageOriginRow }) {
  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50">
      <div className="flex items-center gap-2 flex-wrap">
        <IssuerLink
          issuer={{ id: row.issuer_id }}
          title={`Open ${row.issuer_name} profile`}
          className="tabular text-caos-md text-caos-accent truncate min-w-0 hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
        >
          {row.issuer_name}
        </IssuerLink>
        <span className="flex gap-1 flex-wrap" aria-label={`Source origins: ${row.origins.join(", ")}`}>
          {row.origins.map((origin) => (
            <span
              key={origin}
              className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border border-caos-border text-caos-muted"
            >
              {origin}
            </span>
          ))}
        </span>
      </div>
      <span className="tabular text-caos-xs text-caos-muted">
        {row.analyst_owner ?? "UNASSIGNED"} · {row.document_count} docs
      </span>
    </div>
  );
}

export function ControlPlanePanel() {
  const [data, setData] = useState<IngestionGapsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    getIngestionGaps()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  if (error) {
    return (
      <div role="alert" className="px-3 py-4 tabular text-caos-xs" style={{ color: "var(--caos-critical)" }}>
        ✗ Couldn’t load ingestion coverage.
      </div>
    );
  }
  if (!data) {
    return <div className="px-3 py-4 tabular text-caos-xs text-caos-muted">loading…</div>;
  }

  return (
    // Single column: this panel lives in the ~300px inspector, where a
    // viewport-width md: 2-col query cramps every cell to one word per line.
    <div className="grid grid-cols-1 gap-4 p-2.5">
      <Category title="Zero-chunk documents · vaulted, unusable">
        {data.zero_chunk.length === 0 ? (
          <div className="px-3 py-4 tabular text-caos-xs text-caos-muted" style={{ color: "var(--caos-success)" }}>
            No zero-chunk documents — every vaulted source produced usable text.
          </div>
        ) : (
          data.zero_chunk.map((row) => (
            <GapRow key={row.document_id} row={row} badge="NO TEXT" badgeColor="var(--caos-critical)" />
          ))
        )}
      </Category>
      <Category title="OCR-lane documents · lower fidelity">
        {data.ocr_lane.length === 0 ? (
          <div className="px-3 py-4 tabular text-caos-xs text-caos-muted" style={{ color: "var(--caos-success)" }}>
            No OCR-derived documents — every extraction used a native text layer.
          </div>
        ) : (
          data.ocr_lane.map((row) => (
            <GapRow key={row.document_id} row={row} badge="OCR" badgeColor="var(--caos-warning)" />
          ))
        )}
      </Category>
      <div className="md:col-span-2 pt-1 border-t border-caos-border">
        <Category title="Origin rollup · latest run owner">
          {data.truncated ? (
            <div role="note" className="mx-3 mb-2 tabular text-caos-2xs" style={{ color: "var(--caos-warning)" }}>
              PARTIAL · newest 2,000 documents only
            </div>
          ) : null}
          {data.coverage.length === 0 ? (
            <div className="px-3 py-4 tabular text-caos-xs text-caos-muted">
              No vaulted sources to attribute.
            </div>
          ) : (
            data.coverage.map((row) => <CoverageRow key={row.issuer_id} row={row} />)
          )}
        </Category>
      </div>
    </div>
  );
}
