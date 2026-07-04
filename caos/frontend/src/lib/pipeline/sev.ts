// Severity / state → CSS color utilities. Shared widely across the UI (status
// dots, tags, cards, tranche chips) — kept separate from the sim engine so
// color-only consumers don't transitively depend on the React sim hook and the
// CP-X module data. Pure, no React.

export const SEV_COLOR: Record<string, string> = {
  // high = the sanctioned bright-critical token; the old hardcoded #fb7185 was
  // an undocumented near-twin of --caos-critical-bright (#f87171).
  critical: "var(--caos-critical)", high: "var(--caos-critical-bright)", warning: "var(--caos-warning)",
  medium: "var(--caos-warning)", ok: "var(--caos-success)", pass: "var(--caos-success)",
  low: "var(--caos-muted)", info: "var(--caos-accent)", running: "var(--caos-accent)",
  idle: "var(--caos-idle)", held: "var(--caos-warning)", blocked: "var(--caos-critical)",
  queued: "#52525e", clear: "var(--caos-success)", conditional: "var(--caos-warning)",
};

/** Canonical "module has cleared its gate" predicate: passed, or passed with
 *  warnings — both unblock downstream work. Replaces the
 *  `["pass","warning"].includes(state)` check duplicated across the UI. */
export const isCleared = (state?: string): boolean =>
  state === "pass" || state === "warning";

/** CSS color for a severity/state token (falls back to idle). */
export const sevVar = (sev: string): string => SEV_COLOR[sev] || "var(--caos-idle)";

/** Status-tinted surface — the canonical { color, borderColor, background }
 *  triple for severity-colored cards and tags. Uses color-mix so it works for
 *  both hex and CSS-var severity colors; the old `color + "44"` string was
 *  invalid for the var-based entries and silently dropped the tint. */
export function sevSurface(
  sev: string,
  opts?: { border?: number; wash?: number },
): { color: string; borderColor: string; background: string } {
  const c = sevVar(sev);
  const border = opts?.border ?? 38;
  const wash = opts?.wash ?? 10;
  return {
    color: c,
    borderColor: `color-mix(in srgb, ${c} ${border}%, transparent)`,
    background: `color-mix(in srgb, ${c} ${wash}%, transparent)`,
  };
}
