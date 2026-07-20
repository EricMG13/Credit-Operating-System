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
  queued: "var(--caos-idle)", clear: "var(--caos-success)", conditional: "var(--caos-warning)",
};

/** Canonical "module has cleared its gate" predicate: passed, or passed with
 *  warnings — both unblock downstream work. Replaces the
 *  `["pass","warning"].includes(state)` check duplicated across the UI. */
export const isCleared = (state?: string): boolean =>
  state === "pass" || state === "warning";

/** A live run's per-module `qa_status` → the deep-dive launcher state token.
 *  The engine persists a *failed* module as a real row with `qa_status="Blocked"`
 *  (runner._persist_blocked), so presence-of-output alone can't tell a failure
 *  from a clean pass — it would read Blocked as a false green. This maps the
 *  authoritative status instead:
 *    - undefined      → "idle"         (module not produced in this run at all)
 *    - "Blocked"      → "failed"       (ran but hit the per-module failure gate)
 *    - "Restricted"   → "warning"      (committee-usable with concerns; downstream still clears)
 *    - "Not Reviewed" → "not-reviewed" (produced, but no verdict computed yet —
 *      distinct from a clean "Passed"; a caller that folds this into "pass"
 *      shows an unreviewed module as if it had cleared review)
 *    - anything else defined ("Passed") → "pass"
 *  "failed" is deliberately NOT in isCleared(), so a failed module never unlocks
 *  its pane as if it had produced usable output; "not-reviewed" isn't either,
 *  for the same reason — it hasn't earned that yet. */
export const moduleLiveState = (
  qaStatus: string | undefined,
): "idle" | "failed" | "warning" | "pass" | "not-reviewed" => {
  if (qaStatus === undefined) return "idle";
  if (qaStatus === "Blocked") return "failed";
  if (qaStatus === "Restricted") return "warning";
  if (qaStatus === "Not Reviewed") return "not-reviewed";
  return "pass";
};

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
