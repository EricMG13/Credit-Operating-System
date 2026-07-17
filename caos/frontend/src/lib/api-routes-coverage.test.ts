import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "./api";

const originalAdapter = client.api.defaults.adapter;

const responseFor = (config: { url?: string; method?: string }) => {
  const url = config.url ?? "";
  let data: unknown = { ok: true };
  const headers: Record<string, string> = {};
  if (url === "/api/issuers/") data = [];
  if (url === "/api/query/catalog") data = { metrics: [] };
  if (url === "/api/chat/issuer") data = { reply: "answer" };
  if (url === "/api/reports/versions" && config.method === "get") data = [];
  if (url === "/api/research" && config.method === "post") data = { id: "job-1" };
  if (url === "/api/research/job-1") data = { id: "job-1", status: "complete", report: "done", sources: [], demo: false };
  if (url.endsWith("/export")) {
    data = new Blob(["report"]);
    headers["content-disposition"] = 'attachment; filename="committee.pdf"';
  }
  return Promise.resolve({ data, status: 200, statusText: "OK", headers, config: config as never });
};

beforeEach(() => {
  client.api.defaults.adapter = responseFor as never;
});

afterEach(() => {
  client.api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

describe("API route wrappers", () => {
  it("covers identity, issuer, ingestion, portfolio, and run wrappers", async () => {
    const form = new FormData();
    await Promise.all([
      client.getMe(), client.getPortfolio(), client.createProfile("code", "name"), client.logout(),
      client.listNotifications(), client.listNotifications("cursor"), client.markNotificationSeen("note/1"),
      client.register({ code: "c", name: "n", email: "e", passcode: "p", coverage_area: "TMT", location: "NA", recovery_words: [], recovery_hints: [] }),
      client.login("e", "p"), client.recoverLogin("e", ["a", "b", "c"]),
      client.createIssuer({ name: "Issuer" }), client.getIssuer("issuer-1"), client.getIssuerProfile("issuer-1"),
      client.getCrossDefaultMap("issuer/1"), client.getSponsors(), client.getSponsorTrackRecord("Sponsor / One"),
      client.getDigest(), client.getIssuerFreshness("issuer/1"), client.getContextFreshness("ctx/1"),
      client.askIssuer([{ role: "user", content: "Question" }]), client.getSectorFeeds(), client.updateSectorFeeds([]),
      client.uploadDocument(form), client.uploadPricingSheet(form), client.uploadVaultMemo(form),
      client.getPortfolioDetail("book-1"), client.createPortfolio(form), client.uploadPortfolioHoldings("book-1", form),
      client.createRun("issuer-1"), client.createRun("issuer-1", "2026-07-17", "book-1", "idem", "ctx-1"),
      client.listRuns(), client.listRuns("issuer-1"), client.getRun("run-1"), client.getModule("run-1", "CP-1"),
      client.getModules("run-1"), client.getQA("run-1"), client.createQaFlag({ module_id: "CP-1" }),
      client.exportReport("run-1"), client.exportToVault("run-1"),
    ]);
    expect(client.api.defaults.adapter).not.toBe(originalAdapter);
  });

  it("covers query, scenario, decision, thesis, settings, and model wrappers", async () => {
    await Promise.all([
      client.getMetricCatalog(), client.queryCapabilities(), client.queryGraph("peers", "a", "theme", "b"),
      client.getWatchlist(), client.saveWatchlist(["issuer-1"]), client.scenarioFromNL("rates up"),
      client.propagateScenario({ issuer_id: "issuer-1", run_id: "run-1", ebitda_pct: -0.1, rate_bps: 100 }),
      client.getDecisions("issuer-1"), client.createDecision({ issuer_id: "issuer-1", run_id: "run-1", action: "approve" }),
      client.voteDecision("decision-1", "dissent", "note"), client.reopenDecision("decision-1", "alert-1"),
      client.createThesisVersion({ issuer_id: "issuer-1", thesis_md: "thesis" }), client.realizeThesisPrediction("prediction-1", 4.2),
      client.getSettings(), client.saveAnalystSettings({ model_lanes: {}, email_intelligence: {} }),
      client.getSavedModel("issuer-1"), client.saveModel("issuer-1", { x: 1 }), client.saveModel("issuer-1", { x: 2 }, null),
      client.createModelCheckpoint("issuer-1", { context_id: "ctx-1" }),
      client.restoreModelCheckpoint("checkpoint-1"), client.restoreModelCheckpoint("checkpoint-1", null),
    ]);
  });

  it("covers report version and alert wrappers including optional payloads", async () => {
    const reportBody = { context_id: "ctx-1", run_id: "run-1", model_checkpoint_id: "cp-1", payload: {} };
    const exported = await client.exportReportVersionBinary("version-1", "pdf");
    expect(exported.filename).toBe("committee.pdf");
    await Promise.all([
      client.getReportDraft("ctx-1"), client.saveReportDraft("ctx-1", {}), client.saveReportDraft("ctx-1", {}, 2),
      client.listReportVersions("ctx-1"), client.getReportVersion("version/1"),
      client.previewReportVersion(reportBody), client.publishReportVersion({ ...reportBody, preview_sha256: "hash" }),
      client.setAlertState("alert-1", "ack"),
      client.setAlertState("alert-1", "resolved", { assignee: "analyst", note: "note", resolutionNote: "done" }),
      client.getAlertStates(), client.getAlertStates("alert-1"),
      client.patchAlertEvent("event-1", "ack"),
      client.patchAlertEvent("event-1", "resolved", { assignee: "analyst", note: "note", resolutionNote: "done" }),
    ]);
    client.api.defaults.adapter = ((config: { url?: string }) => Promise.resolve({
      data: new Blob(["xlsx"]), status: 200, statusText: "OK", headers: {}, config: config as never,
    })) as never;
    expect((await client.exportReportVersionBinary("version-2", "xlsx")).filename).toBe("caos-report-version-2.xlsx");
  });

  it("runs and resumes a durable research job and classifies sentinels", async () => {
    const ids: string[] = [];
    await expect(client.deepResearch({ subject: "Telecom", mode: "sector" }, undefined, (id) => ids.push(id), undefined, "ctx-1"))
      .resolves.toEqual({ report: "done", sources: [], demo: false, truncated: undefined, figures: [] });
    await expect(client.resumeResearch("job-1")).resolves.toEqual({ report: "done", sources: [], demo: false, truncated: undefined, figures: [] });
    expect(ids).toEqual(["job-1"]);
    expect(client.isResearchAborted(null)).toBe(false);
    expect(client.isResearchGone(null)).toBe(false);
  });
});
