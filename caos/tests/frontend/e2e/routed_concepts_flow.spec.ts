/**
 * Playwright E2E: routed-concept browser contracts that were absent from the
 * sealed inventory. These fixtures deliberately exercise the mounted UI while
 * failing closed on every unhandled local API request; the frozen-candidate
 * lane must still repeat the journeys against its real API/data setup.
 */

import { expect, test, type Page, type Route } from "@playwright/test";

const authority = {
  origin: "live",
  method: "e2e-contract",
  freshness: "current",
  as_of: "2026-07-20T09:00:00Z",
  source_ids: ["source-e2e"],
  run_id: "run-1",
  version_id: "v1",
  confidence: 1,
  approval_state: "draft",
  analyst_override: null,
};

const baseContext = {
  revision: 1,
  sub_segments: [],
  issuer_ids: ["issuer-1"],
  instrument_ids: [],
  portfolio_scope: "portfolio-1",
  as_of: "2026-07-20",
  sector_review_run_id: null,
  rv_snapshot_id: null,
  rv_run_id: null,
  query_session_id: null,
  artifacts: {
    issuer_run_id: "run-1",
    source_manifest_id: null,
    research_job_id: null,
    model_checkpoint_id: null,
    report_version_id: "report-1",
    alert_event_id: null,
    sponsor_id: null,
    portfolio_id: "portfolio-1",
    decision_id: null,
    insight_id: null,
    artifact_refs: [],
  },
  surface_state: {},
  filters: {},
  selected: {},
  created_at: "2026-07-20T09:00:00Z",
  updated_at: "2026-07-20T09:00:00Z",
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeSparsePatch(current: unknown, patch: unknown): unknown {
  if (!isRecord(current) || !isRecord(patch)) return patch;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "expected_revision") continue;
    merged[key] = key in current ? mergeSparsePatch(current[key], value) : value;
  }
  return merged;
}

async function installShellFixtures(page: Page, input: {
  id: string;
  name: string;
  patch?: Record<string, unknown>;
}) {
  let context = { ...structuredClone(baseContext), id: input.id, name: input.name, ...input.patch };
  let contextPatchCount = 0;
  const unexpectedApi: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Registered first: later exact routes win, leaving this as the final oracle.
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/auth/")) {
      await route.continue();
      return;
    }
    unexpectedApi.push(`${route.request().method()} ${url.pathname}`);
    await fulfillJson(route, { detail: "Unhandled routed-concept E2E fixture request" }, 501);
  });
  await page.route((url) => url.pathname === "/api/settings/analyst", (route) =>
    fulfillJson(route, { model_lanes: {}, email_intelligence: {}, role_view: "analyst", workspace: {}, revision: 1 }));
  await page.route((url) => url.pathname === "/api/notifications", (route) =>
    fulfillJson(route, { items: [], next_cursor: null }));
  await page.route((url) => url.pathname === "/api/analysis/contexts", async (route) => {
    if (route.request().method() === "POST") {
      await fulfillJson(route, context);
      return;
    }
    unexpectedApi.push(`${route.request().method()} /api/analysis/contexts`);
    await fulfillJson(route, { detail: "Method not fixture-backed" }, 405);
  });
  await page.route((url) => url.pathname === `/api/analysis/contexts/${input.id}`, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await fulfillJson(route, context);
      return;
    }
    if (method === "PATCH") {
      contextPatchCount += 1;
      context = {
        ...(mergeSparsePatch(context, route.request().postDataJSON()) as typeof context),
        revision: context.revision + 1,
        updated_at: "2026-07-20T09:01:00Z",
      };
      await fulfillJson(route, context);
      return;
    }
    unexpectedApi.push(`${method} /api/analysis/contexts/${input.id}`);
    await fulfillJson(route, { detail: "Method not fixture-backed" }, 405);
  });
  await page.route((url) => url.pathname === `/api/analysis/contexts/${input.id}/freshness`, (route) =>
    fulfillJson(route, { context_id: input.id, evaluated_at: "2026-07-20T09:00:00Z", artifacts: [] }));
  await page.route((url) => url.pathname === "/api/analysis/findings", (route) => fulfillJson(route, []));

  return { consoleErrors, pageErrors, unexpectedApi, contextPatchCount: () => contextPatchCount };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test.describe("Previously uncovered routed concepts", () => {
  test("Decisions switches from the governed agenda to immutable history", async ({ page }) => {
    const shell = await installShellFixtures(page, { id: "ctx-decisions", name: "IC Book E2E" });
    const agenda = {
      id: "agenda-1",
      issuer_id: "issuer-1",
      portfolio_id: "portfolio-1",
      owner_id: "analyst-1",
      scheduled_for: "2026-07-21T09:00:00Z",
      expiry: "2026-12-31",
      recommendation: "approve",
      conviction: 72,
      thesis: "FCF conversion supports a staged position.",
      conditions: ["Re-test leverage after Q3"],
      run_id: "run-1",
      report_version_id: "report-1",
      context_id: "ctx-decisions",
      status: "ready",
      revision: 2,
      readiness_failures: [],
      finalized_decision_id: null,
      snapshot_sha256: null,
      frozen_authority: null,
      created_at: "2026-07-20T09:00:00Z",
      updated_at: "2026-07-20T09:00:00Z",
      finalized_at: null,
    };
    const decision = {
      id: "decision-1",
      issuer_id: "issuer-1",
      portfolio_id: "portfolio-1",
      agenda_item_id: "agenda-1",
      run_id: "run-1",
      report_id: "report-1",
      report_version_id: "report-1",
      action: "approve",
      status: "active",
      conditions: ["Re-test leverage after Q3"],
      expiry: null,
      snapshot: { agenda: { thesis: agenda.thesis }, context: { id: "ctx-decisions" } },
      snapshot_sha256: "e2e-snapshot-sha256",
      created_by: "analyst-1",
      reopened_at: null,
      reopen_alert_key: null,
      created_at: "2026-07-20T09:00:00Z",
      votes: [],
    };
    await page.route((url) => url.pathname === "/api/issuers/", (route) =>
      fulfillJson(route, [{ id: "issuer-1", name: "Alpha Software", ticker: "ALPH" }]));
    await page.route((url) => url.pathname === "/api/portfolios/", (route) =>
      fulfillJson(route, [{ id: "portfolio-1", name: "Credit Fund I" }]));
    await page.route((url) => url.pathname === "/api/runs", (route) =>
      fulfillJson(route, [{ id: "run-1", committee_status: "Committee Ready" }]));
    await page.route((url) => url.pathname === "/api/issuers/issuer-1/analyst-opinions", (route) =>
      fulfillJson(route, { current: null, items: [] }));
    await page.route((url) => url.pathname === "/api/committee/agenda", (route) =>
      fulfillJson(route, { items: [agenda], next_cursor: null, total: 1 }));
    await page.route((url) => url.pathname === "/api/decisions", (route) =>
      fulfillJson(route, { items: [decision], next_cursor: null, total: 1 }));

    await page.goto("/decisions/?context=ctx-decisions&dataset=agenda");
    await expect(page.getByRole("table", { name: "Committee agenda" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("ALPH", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Decision history" }).click();
    await expect(page.getByRole("table", { name: "Decision history" })).toBeVisible();
    await page.getByText("ALPH", { exact: true }).click();
    await expect(page.getByLabel("Decision inspector")).toContainText("e2e-snapshot-sha256");
    expect(shell.unexpectedApi).toEqual([]);
    expect(shell.pageErrors).toEqual([]);
    expect(shell.consoleErrors).toEqual([]);
  });

  test("Portfolios preserves the working set while switching to constraints", async ({ page }) => {
    const shell = await installShellFixtures(page, { id: "ctx-portfolios", name: "Portfolio Lab E2E" });
    const portfolioAuthority = { ...authority, source_ids: ["portfolio:portfolio-1"], run_id: null };
    const position = {
      id: "position-1",
      portfolio_id: "portfolio-1",
      issuer_id: "issuer-1",
      borrower_name: "Alpha Software",
      ticker: "ALPH",
      figi: "BBG000000001",
      loan_name: "First Lien Term Loan B",
      sector: "Software",
      sub_sector: null,
      ranking: "1L",
      rating_moody: "B2",
      rating_sp: "B",
      par_usd: 10_000_000,
      facility_musd: 500,
      margin_bps: 450,
      maturity: "2029",
      price: 98.5,
      ytm: 8,
      dm: 520,
      market_value: 9_850_000,
      created_at: "2026-07-20T09:00:00Z",
    };
    const analytics = {
      as_of: "2026-06-30",
      concentration: {
        n_positions: 1,
        n_obligors: 1,
        total_nav: 9_850_000,
        total_par: 10_000_000,
        sectors: [{ sector: "Software", mv: 9_850_000, pct_nav: 100, n_obligors: 1 }],
        rating_dist: [{ bucket: "B", mv: 9_850_000, pct_nav: 100, n_obligors: 1 }],
        top10: [{ obligor: "Alpha Software", mv: 9_850_000, pct_nav: 100 }],
        top10_pct_nav: 100,
        wa_rating: "B",
        wa_margin: 450,
        wa_price: 98.5,
        first_lien_pct: 100,
      },
      rating_distribution: { B2: 100 },
      maturity_wall: { "2029": 9_850_000 },
      risk_budget: { status_counts: { Breach: 1, Watch: 0, Pass: 0, Info: 0 }, headroom: [] },
      liquidity: { priced_nav_pct: 100, wa_price: 98.5, unpriced_positions: 0 },
      compliance: [{ code: "SINGLE", category: "Single name", parameter: "Max single name", limit_text: "<= 3%", current: 100, headroom: -97, status: "Breach" }],
      authority: portfolioAuthority,
      missing_dependencies: [],
      latest_stress_runs: [],
    };
    await page.route((url) => url.pathname === "/api/portfolios/", (route) => fulfillJson(route, [{
      id: "portfolio-1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-06-30",
      n_positions: 1, total_nav: 9_850_000, total_par: 10_000_000, breaches: 1, watches: 0,
    }]));
    await page.route((url) => url.pathname === "/api/portfolios/portfolio-1/positions", (route) =>
      fulfillJson(route, { items: [position], total: 1, next_cursor: null, as_of: "2026-06-30", authority: portfolioAuthority }));
    await page.route((url) => url.pathname === "/api/portfolios/portfolio-1/analytics", (route) => fulfillJson(route, analytics));
    await page.route((url) => url.pathname === "/api/portfolios/portfolio-1/stress-runs", (route) =>
      fulfillJson(route, { items: [], total: 0, authority: portfolioAuthority }));
    await page.route((url) => url.pathname === "/api/analysis/contexts/ctx-portfolios/insights", (route) =>
      fulfillJson(route, { items: [], current: null, next_cursor: null }));

    await page.goto("/portfolios/?context=ctx-portfolios&portfolio=portfolio-1&dataset=positions");
    await expect(page.getByRole("table", { name: "Portfolio positions" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Select Alpha Software/i }).click();
    await page.getByRole("tab", { name: "Constraints" }).click();
    await expect(page.getByRole("table", { name: "Portfolio constraints" })).toBeVisible();
    await expect(page.getByText("Alpha Software", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/selected=position-1/);
    expect(shell.unexpectedApi).toEqual([]);
    expect(shell.pageErrors).toEqual([]);
    expect(shell.consoleErrors).toEqual([]);
  });

  test("Issuer Profile keeps live authority while navigating evidence tabs", async ({ page }) => {
    const shell = await installShellFixtures(page, { id: "ctx-profile", name: "Alpha Software profile" });
    const issuer = {
      id: "issuer-1",
      name: "Alpha Software",
      ticker: "ALPH",
      industry: "Software",
      country: "United States",
      figi: "BBG000000001",
      rating_sp: "B",
      rating_moody: "B2",
      rating_fitch: null,
    };
    const run = {
      id: "run-1",
      status: "complete",
      qa_status: "Passed",
      committee_status: "Committee Ready",
      as_of_date: "2026-06-30",
      analyst_id: "analyst-1",
      model_mode: "live",
      created_at: "2026-07-20T09:00:00Z",
      completed_at: "2026-07-20T09:05:00Z",
    };
    const profile = {
      issuer,
      latest_run: run,
      signal_run_id: "run-1",
      runs: [run],
      metrics: [
        { run_id: "run-1", metric_key: "revenue", period: "FY2025", value: 1200, unit: "$M", basis: "reported", provenance: "run", headline: true, qa_status: "Passed", source_claim_id: "claim-1", source_evidence_id: "E-1", document_chunk_id: "chunk-1", source_run_as_of: "2026-06-30" },
        { run_id: "run-1", metric_key: "net_leverage", period: "FY2025", value: 5.2, unit: "x", basis: "adjusted", provenance: "run", headline: true, qa_status: "Passed", source_claim_id: "claim-2", source_evidence_id: "E-2", document_chunk_id: "chunk-2", source_run_as_of: "2026-06-30" },
      ],
      signals: { recommendation: "OVERWEIGHT" },
      coverage: {},
      findings: { CRITICAL: 0, MATERIAL: 0, MINOR: 0 },
      business: [{ fact_area: "business", code: "operating_model", statement: "Recurring subscription revenue.", chunk_id: "chunk-1" }],
      sponsor: {},
      strengths: ["Recurring revenue"],
      weaknesses: ["Elevated leverage"],
      earnings: { latest_period: "Q2 2026", prior_period: "Q1 2026", revenue_growth_pct: 3, ebitda_growth_pct: 2, margin_change_pp: -0.2, monitoring_signals: [] },
    };
    const freshness = { state: "current", source_kind: "run", observed_at: "2026-06-30T00:00:00Z", effective_period_end: "2026-06-30", expected_next_at: null, due_at: null, age_days: 20, reason: "Current completed run", policy_version: "caos-freshness-v1" };
    await page.route((url) => url.pathname === "/api/issuers/issuer-1/profile", (route) => fulfillJson(route, profile));
    await page.route((url) => url.pathname === "/api/issuers/issuer-1/freshness", (route) =>
      fulfillJson(route, { issuer_id: "issuer-1", evaluated_at: "2026-07-20T09:00:00Z", evaluations: [freshness] }));
    await page.route((url) => url.pathname === "/api/runs/run-1/freshness", (route) =>
      fulfillJson(route, { run_id: "run-1", evaluated_at: "2026-07-20T09:00:00Z", evaluation: freshness }));
    await page.route((url) => url.pathname === "/api/issuers/issuer-1/cross-default", (route) =>
      fulfillJson(route, { issuer_id: "issuer-1", run_id: "run-1", threshold_musd: null, dominoes: [], note: "No extracted threshold." }));
    await page.route((url) => url.pathname === "/api/issuers/issuer-1/analyst-opinions", (route) =>
      fulfillJson(route, { current: null, items: [] }));
    await page.route((url) => url.pathname === "/api/thesis", (route) => fulfillJson(route, []));
    await page.route((url) => url.pathname === "/api/query/graph", (route) =>
      fulfillJson(route, { capability_id: "analyst-memos", nodes: [], edges: [], summary: "No linked notes", warnings: [] }));

    await page.goto("/issuers/profile/?id=issuer-1&context=ctx-profile");
    await expect(page.getByText("Alpha Software", { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("LIVE", { exact: true }).first()).toBeVisible();
    const financialsTab = page.getByRole("tab", { name: "Financials" });
    try {
      await expect(financialsTab).toBeVisible({ timeout: 10000 });
    } catch {
      throw new Error(`Issuer Profile render failed: ${[...shell.pageErrors, ...shell.consoleErrors].join(" | ") || "no browser error captured"}`);
    }
    await financialsTab.click();
    await expect(page.getByText("Financial & credit trend", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Evidence / QA" }).click();
    await expect(page.getByText("QA findings", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/tab=evidence/);
    expect(shell.unexpectedApi).toEqual([]);
    expect(shell.pageErrors).toEqual([]);
    expect(shell.consoleErrors).toEqual([]);
  });

  test("Sector RV compares exact instruments and ratifies an actionable candidate", async ({ page }) => {
    const shell = await installShellFixtures(page, {
      id: "ctx-rv",
      name: "Telecom RV E2E",
      patch: { sector_id: "telecom", rv_run_id: "rv-1", rv_snapshot_id: "snapshot-1" },
    });
    let ratificationHits = 0;
    const candidates = [
      {
        id: "candidate-1", instrument_id: "instrument-1", instrument_key: "FIGI-1:0", figi: "FIGI-1",
        borrower: "Alpha Telecom", rank: 1, classification: "actionable", recommendation: "Add",
        missing_gates: [], market: { dm: 655, bid: 97, ask: 98, ranking: "1L", maturity: "2028" },
        pitch: { market_relative_value: { dm_pickup_bps: 38 }, instrument_mispricing: { recovery: 62 }, portfolio_implementation: { held: false } },
        evidence: {}, portfolio_impact: {}, ratified_at: null,
      },
      {
        id: "candidate-2", instrument_id: "instrument-2", instrument_key: "FIGI-2:0", figi: "FIGI-2",
        borrower: "Beta Telecom", rank: 2, classification: "screen-only", recommendation: "Screen only",
        missing_gates: ["recovery evidence"], market: { dm: 610, bid: 98, ask: 99, ranking: "1L", maturity: "2029" },
        pitch: { market_relative_value: { dm_pickup_bps: 21 }, instrument_mispricing: { recovery: null }, portfolio_implementation: { held: true } },
        evidence: {}, portfolio_impact: {}, ratified_at: null,
      },
    ];
    const screen = {
      id: "rv-1", context_id: "ctx-rv", snapshot_id: "snapshot-1", snapshot_source_label: "Live pricing",
      snapshot_freshness: { state: "current" }, status: "ready", filters: {}, authority,
      candidates, counts: { actionable: 1, "screen-only": 1, unavailable: 0 }, missing_dependencies: [],
      created_at: "2026-07-20T09:00:00Z", updated_at: "2026-07-20T09:00:00Z",
    };
    await page.route((url) => url.pathname === "/api/rv/screens/rv-1", (route) => fulfillJson(route, screen));
    await page.route((url) => url.pathname === "/api/rv/screens/rv-1/ratifications", async (route) => {
      ratificationHits += 1;
      await fulfillJson(route, {
        ...screen,
        candidates: candidates.map((candidate) => candidate.id === "candidate-1"
          ? { ...candidate, ratified_at: "2026-07-20T09:05:00Z" }
          : candidate),
      });
    });

    await page.goto("/sector-rv/?context=ctx-rv&selected=candidate-1");
    const grid = page.getByRole("grid", { name: "Ranked RV candidates" });
    await expect(grid).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Alpha Telecom", { exact: true }).first()).toBeVisible();
    await grid.getByRole("row", { name: /Alpha Telecom/ }).getByRole("button", { name: "Compare", exact: true }).click();
    await grid.getByRole("row", { name: /Beta Telecom/ }).getByRole("button", { name: "Compare", exact: true }).click();
    await page.getByRole("tab", { name: "Compare selected (2)" }).click();
    await expect(page.getByText("Alpha Telecom", { exact: true }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Ranked names" }).click();
    await page.getByRole("button", { name: "Ratify candidate" }).click();
    await expect(page.getByRole("button", { name: "Ratified" })).toBeVisible();
    expect(ratificationHits).toBe(1);
    expect(shell.unexpectedApi).toEqual([]);
    expect(shell.pageErrors).toEqual([]);
    expect(shell.consoleErrors).toEqual([]);
  });

  test("Sponsors preserves selection through a failed record read and retry", async ({ page }) => {
    const shell = await installShellFixtures(page, {
      id: "ctx-sponsors",
      name: "Sponsor review E2E",
      patch: { artifacts: { ...baseContext.artifacts, sponsor_id: "Alpha Capital" } },
    });
    let recordHits = 0;
    await page.route((url) => url.pathname === "/api/sponsors/", (route) =>
      fulfillJson(route, [{ sponsor: "Alpha Capital", issuer_count: 2 }, { sponsor: "Beta Partners", issuer_count: 1 }]));
    await page.route((url) => /^\/api\/sponsors\/[^/]+$/.test(url.pathname), async (route) => {
      recordHits += 1;
      if (recordHits === 1) {
        await fulfillJson(route, { detail: "sponsor record temporarily unavailable" }, 503);
        return;
      }
      await fulfillJson(route, {
        sponsor: "Alpha Capital",
        issuer_count: 2,
        avg_governance_risk_score: 4,
        flag_counts: { "Aggressive add-backs": 2 },
        issuers: [
          { issuer_id: "issuer-1", name: "Alpha Software", ticker: "ALPH", run_id: "run-1", qa_status: "Blocked", governance_risk_score: 5, flags: ["Aggressive"], net_leverage: 5.4 },
          { issuer_id: "issuer-2", name: "Beta Services", ticker: "BETA", run_id: null, qa_status: null, governance_risk_score: null, flags: [], net_leverage: null },
        ],
      });
    });

    await page.goto("/sponsors/?context=ctx-sponsors");
    await expect(page.getByText("Sponsor record unavailable", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Preserved: Alpha Capital", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Aggressive add-backs · 2 of 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Alpha Software/ })).toBeVisible();
    expect(recordHits).toBe(2);
    await expect.poll(shell.contextPatchCount).toBe(1);
    expect(shell.unexpectedApi).toEqual([]);
    expect(shell.pageErrors).toEqual([]);
    expect(shell.consoleErrors.length).toBeLessThanOrEqual(1);
    expect(shell.consoleErrors.every((message) =>
      message === "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
    )).toBe(true);
  });
});
