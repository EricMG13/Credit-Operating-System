import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "./api";

const originalAdapter = client.api.defaults.adapter;

const axiosError = (status: number) => Object.assign(new Error(`HTTP ${status}`), {
  isAxiosError: true,
  response: { status, data: {}, headers: {}, statusText: String(status), config: {} },
});

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

  it("maps every durable research status and preserves transient failures", async () => {
    const statuses = [
      { id: "running", status: "running" },
      { id: "complete", status: "complete", report: "memo", sources: [], demo: true, truncated: true },
      { id: "failed", status: "failed", error: "model failed" },
      { id: "failed-default", status: "failed", error: "" },
    ];
    client.api.defaults.adapter = ((config: { url?: string }) => Promise.resolve({
      data: statuses.find((status) => config.url?.endsWith(`/${status.id}`)),
      status: 200,
      statusText: "OK",
      headers: {},
      config: config as never,
    })) as never;

    await expect(client.getResearchStatus("running")).resolves.toEqual({ state: "running" });
    await expect(client.getResearchStatus("complete")).resolves.toEqual({
      state: "complete",
      result: { report: "memo", sources: [], demo: true, truncated: true, figures: [] },
    });
    await expect(client.getResearchStatus("failed")).resolves.toEqual({ state: "failed", error: "model failed" });
    await expect(client.getResearchStatus("failed-default")).resolves.toEqual({
      state: "failed",
      error: "Research failed — try again.",
    });

    const transient = new Error("temporary outage");
    client.api.defaults.adapter = (() => Promise.reject(transient)) as never;
    await expect(client.getResearchStatus("transient")).rejects.toBe(transient);
    client.api.defaults.adapter = (() => Promise.reject(axiosError(404))) as never;
    await expect(client.getResearchStatus("missing")).resolves.toEqual({ state: "gone" });
  });

  it("classifies missing and aborted research polls", async () => {
    client.api.defaults.adapter = (() => Promise.reject(axiosError(404))) as never;
    const missing = await client.resumeResearch("missing").catch((error) => error);
    expect(client.isResearchGone(missing)).toBe(true);
    expect(client.isResearchGone({})).toBe(false);

    const controller = new AbortController();
    controller.abort();
    const aborted = await client.resumeResearch("job-1", undefined, controller.signal).catch((error) => error);
    expect(client.isResearchAborted(aborted)).toBe(true);
    expect(client.isResearchAborted({})).toBe(false);
  });

  it("recovers after a transient poll error and publishes live progress", async () => {
    vi.useFakeTimers();
    const progress: Array<client.ResearchProgress | null> = [];
    let attempts = 0;
    client.api.defaults.adapter = ((config: { url?: string }) => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error("gateway blip"));
      return Promise.resolve({
        data: attempts === 2
          ? { id: "job-1", status: "running", progress: { sources: 3, searches: 2 } }
          : attempts === 3
            ? { id: "job-1", status: "running" }
            : { id: "job-1", status: "complete", report: "recovered", sources: [], demo: false },
        status: 200,
        statusText: "OK",
        headers: {},
        config: config as never,
      });
    }) as never;

    const result = client.resumeResearch("job-1", (value) => progress.push(value));
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(result).resolves.toEqual({ report: "recovered", sources: [], demo: false, truncated: undefined, figures: [] });
    expect(progress).toEqual([{ sources: 3, searches: 2 }, null]);
  });

  it("surfaces failed polls and the client deadline", async () => {
    let failure = "model failed";
    client.api.defaults.adapter = ((config: { url?: string }) => Promise.resolve({
      data: { id: "job-1", status: "failed", error: failure },
      status: 200,
      statusText: "OK",
      headers: {},
      config: config as never,
    })) as never;
    await expect(client.resumeResearch("job-1")).rejects.toEqual({ response: { data: { detail: "model failed" } } });
    failure = "";
    await expect(client.resumeResearch("job-1")).rejects.toEqual({
      response: { data: { detail: "Research failed — try again." } },
    });

    vi.useFakeTimers();
    const started = new Date("2026-07-19T00:00:00Z");
    vi.setSystemTime(started);
    client.api.defaults.adapter = ((config: { url?: string }) => {
      vi.setSystemTime(new Date(started.getTime() + 15 * 60 * 1_000));
      return Promise.resolve({
        data: { id: "job-1", status: "running" },
        status: 200,
        statusText: "OK",
        headers: {},
        config: config as never,
      });
    }) as never;
    await expect(client.resumeResearch("job-1")).rejects.toEqual({
      response: { data: { detail: "Research timed out on the client — it may still be completing; retry shortly." } },
    });
  });

  it("starts research without optional context or callbacks", async () => {
    await expect(client.deepResearch({ subject: "Utilities", mode: "issuer" })).resolves.toEqual({
      report: "done",
      sources: [],
      demo: false,
      truncated: undefined,
      figures: [],
    });
  });

  it("stops polling after the maximum consecutive transport failures", async () => {
    vi.useFakeTimers();
    client.api.defaults.adapter = (() => Promise.reject(new Error("offline"))) as never;

    const result = client.resumeResearch("job-1");
    const rejection = expect(result).rejects.toEqual({
      response: { data: { detail: "Lost contact with the research backend — the run may still be completing; retry shortly." } },
    });
    await vi.runAllTimersAsync();
    await rejection;
  });
});
