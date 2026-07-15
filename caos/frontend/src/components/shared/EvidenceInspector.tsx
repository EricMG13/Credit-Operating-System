import type { Provenance } from "@/lib/provenance";
import { ConclusionAuthority } from "./ConclusionAuthority";

export interface EvidenceClaim {
  id: string;
  text: string;
  source?: string;
  state?: "current" | "stale" | "conflicted" | "missing";
}

export function EvidenceInspector({
  title = "Evidence inspector",
  provenance,
  approval,
  asOf,
  claims = [],
  consumers = [],
  glossary = [],
  className = "",
}: {
  title?: string;
  provenance: Provenance;
  approval?: "UNRATIFIED" | "RATIFIED" | "CONDITIONAL" | "DRAFT";
  asOf: string;
  claims?: EvidenceClaim[];
  consumers?: string[];
  glossary?: Array<{ term: string; definition: string }>;
  className?: string;
}) {
  return (
    <aside aria-label={title} className={`caos-evidence-inspector ${className}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-caos-border px-3 py-2">
        <h2 className="tabular text-caos-md font-semibold uppercase tracking-[0.12em] text-caos-text">{title}</h2>
        <span className="ml-auto tabular text-caos-2xs text-caos-muted">as of {asOf}</span>
      </div>
      <div className="p-3 space-y-3 overflow-auto">
        <ConclusionAuthority prov={{ ...provenance, asOf }} approval={approval} />
        {claims.length ? (
          <ol className="space-y-2">
            {claims.map((claim) => (
              <li key={claim.id} className="grid grid-cols-[auto_1fr] gap-2 border-t border-caos-border/60 pt-2 first:border-t-0 first:pt-0">
                <span className="tabular text-caos-2xs text-caos-accent">{claim.id}</span>
                <div>
                  <p className="text-caos-md leading-relaxed text-caos-text">{claim.text}</p>
                  <p className="mt-1 tabular text-caos-2xs text-caos-muted">{claim.source ?? "Source unavailable"}{claim.state ? ` · ${claim.state}` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="text-caos-xs text-caos-muted">No claim selected.</p>}
        {consumers.length ? (
          <div>
            <h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Downstream consumers</h3>
            <p className="mt-1 text-caos-xs text-caos-text">{consumers.join(" · ")}</p>
          </div>
        ) : null}
        {glossary.length ? (
          <details className="border-t border-caos-border pt-2">
            <summary className="tabular text-caos-xs text-caos-accent cursor-pointer focus-ring">Desk glossary</summary>
            <dl className="mt-2 space-y-2">
              {glossary.map((entry) => (
                <div key={entry.term}>
                  <dt className="tabular text-caos-2xs font-semibold text-caos-text">{entry.term}</dt>
                  <dd className="mt-0.5 text-caos-xs leading-relaxed text-caos-muted">{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </aside>
  );
}
