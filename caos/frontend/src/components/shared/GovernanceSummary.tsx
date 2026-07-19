import { Panel } from "@/components/shared/Panel";

export type GovernanceSummaryProps = {
  qa?: number;
  failed?: number;
  gaps?: number;
  mixed?: number;
  stale?: number;
  coldStart?: boolean;
  onOpen: () => void;
};

export function GovernanceSummary({ qa, failed, gaps, mixed, stale, coldStart = false, onOpen }: GovernanceSummaryProps) {
  const rows = [["CP-5 findings", qa], ["Failed gates", failed], ["Source gaps", gaps], ["Mixed origin", mixed], ["Stale sources", stale]] as const;
  return <Panel title="Governance summary"><dl className="grid gap-1 p-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-caos-border/40 py-1"><dt className="text-caos-xs text-caos-muted">{label}</dt><dd className="tabular text-caos-sm text-caos-text">{value ?? "Unavailable"}</dd></div>)}</dl>{coldStart ? <p className="px-2 pb-1 text-caos-2xs leading-snug text-caos-muted">Queues are observed-empty — the first completed run populates them.</p> : null}<button type="button" onClick={onOpen} className="caos-action-secondary focus-ring m-2">Open governance queue</button></Panel>;
}
