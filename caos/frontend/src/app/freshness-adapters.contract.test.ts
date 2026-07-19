import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("Phase 1D surface freshness contracts", () => {
  it("Command uses central four-state digest counts and never infers CURRENT from an empty legacy stale list", () => {
    const page = source("./command/page.tsx");
    expect(page).toContain("digest.freshness.counts.unknown");
    expect(page).toContain("Central evidence freshness unavailable");
    expect(page).not.toMatch(/digest\.stale\.length\s*>\s*0\s*\?\s*["']STALE["']\s*:\s*["']CURRENT["']/);
  });

  it("Issuer Profile removes the hard-coded CURRENT and prefers an exact active derived artifact before run fallback", () => {
    const page = source("./issuers/profile/ProfileContent.tsx");
    expect(page).toContain("analysis.context?.artifacts.model_checkpoint_id");
    expect(page).toContain("derivedFreshness(");
    expect(page).toContain("toProvFreshness(profileFreshness)");
    expect(page).not.toContain('freshness: "CURRENT" as const');
  });

  it("Pipeline binds URL and live selections plus worklist cells to exact run ids", () => {
    const page = source("./pipeline/page.tsx");
    expect(page).toContain("resolvePipelineFreshnessRunId(runParam, live?.runId)");
    expect(page).toContain("useIssuerFreshness({ runId: freshnessRunId })");
    expect(page).toContain("model.live.freshnessRunId ? <FreshnessIndicator evaluation={model.live.selectedRunFreshness} /> : null");
    expect(page).toContain("<RunFreshnessCell runId={item.id} />");
    expect(page).toContain("selectedFreshnessRead.run?.evaluation");
  });

  it("Model maps current to ready, due and unknown to partial, and stale to stale", () => {
    const page = source("./model/page.tsx");
    expect(page).toContain('freshness?.state === "stale" ? "stale"');
    expect(page).toContain('freshness?.state === "current" ? "ready" : "partial"');
    expect(page).toContain('freshness.state === "due" ? ["anchor run refresh due"]');
    expect(page).toContain("toProvFreshness(freshness)");
  });

  it("Report binds a selected immutable version to its own report and run ids", () => {
    const page = source("./reports/page.tsx");
    const document = source("../components/reports/ReportDoc.tsx");
    expect(page).toContain("versions.find((version) => version.id === rep?.id)");
    expect(page).toContain("resolveReportFreshnessTarget(");
    expect(page).toContain("const activeVersionId = selectedPublishedVersion?.id ?? null");
    expect(page).toContain("<FreshnessIndicator evaluation={reportFreshness} />");
    expect(page).toContain("freshness: toProvFreshness(reportFreshness)");
    expect(document).toContain("freshness?: ProvFreshness");
    expect(document).toContain("<ReportAuthority {...authority} />");
  });
});
