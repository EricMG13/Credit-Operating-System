import { ProvenanceChip } from "./ProvenanceChip";
import type { Provenance } from "@/lib/provenance";

/** Conclusion-level authority. Origin and method are never allowed to stand
 * alone beside generated analysis: approval is adjacent and part of the
 * accessible name so LIVE cannot be read as ratified. */
export function ConclusionAuthority({
  prov,
  approval = "UNRATIFIED",
}: {
  prov: Provenance;
  /** null = there is no conclusion to approve (empty/idle state) — the
   * approval chip is suppressed rather than stamping UNRATIFIED on nothing. */
  approval?: "UNRATIFIED" | "RATIFIED" | "CONDITIONAL" | "DRAFT" | null;
}) {
  const label = [
    `Origin ${prov.origin}`,
    prov.method ? `method ${prov.method}` : null,
    approval ? `approval ${approval}` : null,
    prov.freshness ? `freshness ${prov.freshness}` : null,
  ].filter(Boolean).join(", ");

  return (
    <span className="inline-flex items-center gap-1" aria-label={label} title={prov.detail}>
      <ProvenanceChip prov={prov} />
      {approval ? <span
        className="tabular text-caos-2xs uppercase tracking-wider rounded-sm border border-caos-warning/50 bg-caos-warning/5 px-1.5 py-0.5 text-caos-warning"
      >
        {approval}
      </span> : null}
    </span>
  );
}
