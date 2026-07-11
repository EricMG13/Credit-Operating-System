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

import type { RunPhase } from "@/lib/engine/useLatestRun";

export type DeepDiveCaveatKind = "reference" | "loading" | "error" | "live" | "noRun";

export function deepDiveCaveatKind(p: {
  isReference: boolean;
  loading: boolean;
  runId: string | null;
  // M-3: useLiveRun's phase — lets a genuine backend fetch failure be told apart
  // from "issuer exists, never analysed" (noRun), which previously collapsed to
  // the same generic message. Optional so a caller with no phase signal degrades
  // to the pre-existing runId-only behavior.
  phase?: RunPhase;
}): DeepDiveCaveatKind {
  if (p.isReference) return "reference"; // the ATLF showcase deal itself
  if (p.loading) return "loading"; // still resolving the latest run
  if (p.phase === "error") return "error"; // fetch failed — state is unknown, not "no run"
  if (p.runId) return "live"; // a completed run backs the live modules
  return "noRun"; // issuer exists, never analysed — all figures are template
}
