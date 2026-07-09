// Portfolio head-stat (label + tabular value) shared by the Command and Monitor
// sub-headers. `big` bumps the value to the hero size; `c` tints it. `onClick`
// is optional — pass it only when this stat summarizes content the analyst can
// jump to (e.g. a buried governance panel); omitted, it renders the original
// non-interactive span. Extracted from a verbatim clone in both page headers
// (fallow dup:2bc80839).
export const headStat = (l: string, v: string, c?: string, big?: boolean, onClick?: () => void) => {
  const inner = (
    <>
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{l}</span>
      <span className={"tabular " + (big ? "text-caos-metric font-medium" : "text-caos-2xl")} style={{ color: c }}>{v}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        key={l}
        type="button"
        onClick={onClick}
        title={`Jump to ${l.toLowerCase()}`}
        className="flex items-baseline gap-1.5 whitespace-nowrap rounded hover:opacity-80 transition-caos focus-ring cursor-pointer"
      >
        {inner}
      </button>
    );
  }
  return (
    <span key={l} className="flex items-baseline gap-1.5 whitespace-nowrap">
      {inner}
    </span>
  );
};
