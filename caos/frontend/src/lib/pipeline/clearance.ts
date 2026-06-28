// Clearance headline for the Pipeline Visualizer. Extracted verbatim from the
// inline derivation so the page component stays readable. Live runs report the
// run's QA verdict (committee_status); a Blocked run must never read "Full Run".
// Offline/demo falls back to the CP-X route gate (CP-5 state).

export type ClearanceTag = "ok" | "warning" | "critical" | "idle" | "running";
export type Clearance = { tag: ClearanceTag; text: string };

export function deriveClearance(opts: {
  useLive: boolean;
  live: { committeeStatus: string; gateStatus: string } | null;
  cp5: string;
  modeDone: Clearance;
}): Clearance {
  const { useLive, live, cp5, modeDone } = opts;
  const liveClear: Clearance | null = useLive
    ? live!.committeeStatus === "Blocked"
      ? { tag: "critical", text: "CLEARANCE: BLOCKED" }
      : live!.committeeStatus === "Restricted"
      ? { tag: "warning", text: "CLEARANCE: RESTRICTED" }
      : live!.committeeStatus === "Committee Ready"
      ? { tag: "ok", text: `CLEARANCE: COMMITTEE READY · ${live!.gateStatus}` }
      : { tag: "idle", text: `CLEARANCE: ${live!.committeeStatus}` }
    : null;
  return liveClear
    ? liveClear
    : ["pass", "warning", "held"].includes(cp5)
    ? modeDone
    : cp5 === "running"
    ? { tag: "running", text: "CP-5 QA audit in progress…" }
    : { tag: "idle", text: "CLEARANCE: pending upstream completion" };
}
