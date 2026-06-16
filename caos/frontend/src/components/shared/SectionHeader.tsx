// Shared inner section header: the small uppercase "CP-xx · label" strip with
// an optional right-aligned meta slot, used inside panels and cards across the
// Deep-Dive tabs. Distinct from the 32px <Panel> chrome header — this is the
// header *within* a content card. Phase 0 foundation.

export function SectionHeader({
  title,
  right,
  className = "",
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"px-3 py-2 border-b border-caos-border flex items-center gap-2 " + className}>
      <span className="tabular text-caos-sm uppercase tracking-wider text-caos-muted">{title}</span>
      {right ? <span className="tabular text-caos-sm text-caos-muted ml-auto">{right}</span> : null}
    </div>
  );
}
