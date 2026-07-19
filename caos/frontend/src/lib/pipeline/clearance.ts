// Clearance headline for the Pipeline Visualizer. Extracted verbatim from the
// inline derivation so the page component stays readable. Live runs report the
// run's QA verdict (committee_status); a Blocked run must never read "Full Run".
// Offline/demo falls back to the CP-X route gate (CP-5 state).

export type ClearanceTag = "ok" | "warning" | "critical" | "idle" | "running";
export type Clearance = { tag: ClearanceTag; text: string };

const liveClearance = (live: { committeeStatus: string; gateStatus: string }): Clearance => {
  if (live.committeeStatus === "Blocked") return { tag: "critical", text: "CLEARANCE: BLOCKED" };
  if (live.committeeStatus === "Restricted") return { tag: "warning", text: "CLEARANCE: RESTRICTED" };
  if (live.committeeStatus === "Committee Ready") {
    return { tag: "ok", text: `CLEARANCE: COMMITTEE READY · ${live.gateStatus}` };
  }
  return { tag: "idle", text: `CLEARANCE: ${live.committeeStatus}` };
};

const offlineClearance = (cp5: string, modeDone: Clearance): Clearance => {
  if (["pass", "warning", "held"].includes(cp5)) return modeDone;
  if (cp5 === "running") return { tag: "running", text: "CP-5 QA audit in progress…" };
  return { tag: "idle", text: "CLEARANCE: pending upstream completion" };
};

export function deriveClearance(opts: {
  useLive: boolean;
  live: { committeeStatus: string; gateStatus: string } | null;
  cp5: string;
  modeDone: Clearance;
}): Clearance {
  const { useLive, live, cp5, modeDone } = opts;
  return useLive ? liveClearance(live!) : offlineClearance(cp5, modeDone);
}
