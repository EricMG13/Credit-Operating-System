// Portfolio head-stat (label + tabular value) shared by the Command and Monitor
// sub-headers. `big` bumps the value to the hero size; `c` tints it. Extracted
// from a verbatim clone in both page headers (fallow dup:2bc80839).
export const headStat = (l: string, v: string, c?: string, big?: boolean) => (
  <span key={l} className="flex items-baseline gap-1.5 whitespace-nowrap">
    <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{l}</span>
    <span className={"tabular " + (big ? "text-[14px] font-medium" : "text-caos-2xl")} style={{ color: c }}>{v}</span>
  </span>
);
