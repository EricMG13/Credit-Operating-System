import { describe, expect, it } from "vitest";
import { deriveClearance, type Clearance } from "./clearance";

const DONE: Clearance = { tag: "ok", text: "FULL RUN" };
const live = (committeeStatus: string, gateStatus = "PASS") => ({ committeeStatus, gateStatus });

describe("deriveClearance — live run reports the QA verdict, not the route gate", () => {
  it("Blocked is critical even when the route gate would read clear", () => {
    expect(deriveClearance({ useLive: true, live: live("Blocked"), cp5: "pass", modeDone: DONE })).toEqual({
      tag: "critical",
      text: "CLEARANCE: BLOCKED",
    });
  });

  it("Restricted is a warning", () => {
    expect(deriveClearance({ useLive: true, live: live("Restricted"), cp5: "idle", modeDone: DONE }).tag).toBe("warning");
  });

  it("Committee Ready folds in the gate status", () => {
    expect(deriveClearance({ useLive: true, live: live("Committee Ready", "J1"), cp5: "idle", modeDone: DONE })).toEqual({
      tag: "ok",
      text: "CLEARANCE: COMMITTEE READY · J1",
    });
  });

  it("any other live status echoes through as idle", () => {
    expect(deriveClearance({ useLive: true, live: live("In Review"), cp5: "idle", modeDone: DONE })).toEqual({
      tag: "idle",
      text: "CLEARANCE: In Review",
    });
  });
});

describe("deriveClearance — offline/demo falls back to the CP-5 route gate", () => {
  it("a finished CP-5 (pass/warning/held) yields the mode's done headline", () => {
    for (const cp5 of ["pass", "warning", "held"]) {
      expect(deriveClearance({ useLive: false, live: null, cp5, modeDone: DONE })).toBe(DONE);
    }
  });

  it("CP-5 running shows the audit-in-progress headline", () => {
    expect(deriveClearance({ useLive: false, live: null, cp5: "running", modeDone: DONE }).tag).toBe("running");
  });

  it("anything else is idle/pending", () => {
    expect(deriveClearance({ useLive: false, live: null, cp5: "idle", modeDone: DONE })).toEqual({
      tag: "idle",
      text: "CLEARANCE: pending upstream completion",
    });
  });
});
