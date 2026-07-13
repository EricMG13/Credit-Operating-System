import { describe, expect, it } from "vitest";
import { buildLiveReports, reportFromVersion } from "./live-builder";

describe("live Report Studio composition", () => {
  it("builds only from the selected live run modules and carries evidence", () => {
    const reports = buildLiveReports({
      issuerId: "issuer-1", runId: "run-1", asOf: "2026-06-30", committeeStatus: "Committee Ready",
      liveStatus: { "CP-1": "Passed" },
      liveOuts: { "CP-1": { kpis: [{ l: "Net leverage", v: "5.2x" }], sections: [{ type: "text", title: "Credit view", body: "Deleveraging continues.", ev: ["E-1"] }] } },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].subtitle).toContain("run run-1");
    expect(reports[0].srcs[0]).toEqual({ chip: "CP-1", ev: ["E-1"] });
    expect(JSON.stringify(reports[0])).not.toContain("Atlas Forge");
  });

  it("restores the exact rendered report stored in an immutable version", () => {
    const rendered = buildLiveReports({ issuerId: "issuer-1", runId: "run-1", liveStatus: {}, liveOuts: { "CP-1": { kpis: [], sections: [{ type: "text", title: "View", body: "Frozen" }] } } })[0];
    const report = reportFromVersion({ id: "version-1", run_id: "run-1", created_at: "2026-07-13", payload: { composition: { rendered_report: rendered } } });
    expect(report.id).toBe("version-1");
    expect(report.title).toContain("published");
    expect(report.sections).toEqual(rendered.sections);
  });
});
