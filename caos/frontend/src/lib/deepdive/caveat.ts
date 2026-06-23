// Deep-Dive honesty caveat — decides what disclaimer the sub-header shows for
// the resolved issuer. The bespoke debate/recovery/covenant tabs and the DEAL
// narrative are ATLF reference fixtures, so a non-reference issuer must never be
// shown reference content *as if it were its own analysis*.
//
// The dangerous state is `noRun`: an issuer that exists but has never been run
// still renders the full reference template. Before this, the sub-header said
// "live engine output · bespoke tabs show the ATLF reference template" for every
// non-reference issuer — implying live modules reflect the issuer even when zero
// runs exist. `noRun` makes the disclaimer truthful: nothing here is this issuer.

export type DeepDiveCaveatKind = "reference" | "loading" | "live" | "noRun";

export function deepDiveCaveatKind(p: {
  isReference: boolean;
  loading: boolean;
  runId: string | null;
}): DeepDiveCaveatKind {
  if (p.isReference) return "reference"; // the ATLF showcase deal itself
  if (p.loading) return "loading"; // still resolving the latest run
  if (p.runId) return "live"; // a completed run backs the live modules
  return "noRun"; // issuer exists, never analysed — all figures are template
}
