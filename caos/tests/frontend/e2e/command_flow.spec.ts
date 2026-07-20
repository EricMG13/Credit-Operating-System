/**
 * Playwright E2E: current Command Center persisted-portfolio workbench.
 *
 * Every local fixture is matched by URL pathname, so Axios requests with or
 * without query strings cannot fall through to a developer's live dataset.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

type CommandMode = "ready" | "directory-error" | "invalid-request";

const authority = {
  provenance: { origin: "LIVE", method: "DERIVED", freshness: "CURRENT", detail: "E2E fixture" },
  approval: "UNRATIFIED",
};

const portfolios = [
  {
    id: "portfolio-qa",
    name: "Credit Opportunities I",
    kind: "CLO",
    as_of_date: "2026-06-30",
    n_positions: 1,
    total_nav: 98_500_000,
    total_par: 100_000_000,
    breaches: 0,
    watches: 1,
  },
  {
    id: "portfolio-alt",
    name: "Alternative Sleeve",
    kind: "FUND",
    as_of_date: "2026-06-30",
    n_positions: 1,
    total_nav: 49_750_000,
    total_par: 50_000_000,
    breaches: 0,
    watches: 0,
  },
];

// fallow-ignore-next-line complexity -- Playwright fixture branch coverage is outside the Istanbul unit-coverage map.
const position = (portfolioId: string, suffix: string) => ({
  id: `position-${suffix}`,
  portfolio_id: portfolioId,
  issuer_id: `issuer-${suffix}`,
  borrower_name: suffix === "atlas" ? "Atlas Forge" : "Borealis Metals",
  ticker: suffix === "atlas" ? "ATLF" : "BRM",
  figi: `BBG-${suffix}`,
  loan_name: "First Lien Term Loan B 2031",
  sector: suffix === "atlas" ? "Industrials" : "Materials",
  sub_sector: "Diversified",
  ranking: "1L",
  rating_moody: "B2",
  rating_sp: "B",
  par_usd: suffix === "atlas" ? 100_000_000 : 50_000_000,
  facility_musd: 500,
  margin_bps: 475,
  maturity: "2031-06-30",
  price: suffix === "atlas" ? 98.5 : 99.5,
  ytm: 8.2,
  dm: 510,
  market_value: suffix === "atlas" ? 98_500_000 : 49_750_000,
  created_at: "2026-07-15T00:00:00Z",
  posture: suffix === "atlas" ? "OVERWEIGHT" : "NEUTRAL",
  run_id: `run-${suffix}`,
  qa_status: "Passed",
  committee_status: "Committee Ready",
});

// fallow-ignore-next-line complexity -- Playwright fixture branch coverage is outside the Istanbul unit-coverage map.
const snapshot = (portfolioId: string, empty = false) => {
  const isAlt = portfolioId === "portfolio-alt";
  const selected = portfolios.find((row) => row.id === portfolioId) ?? portfolios[0];
  const positions = empty ? [] : [position(portfolioId, isAlt ? "borealis" : "atlas")];
  return {
    portfolio: { id: selected.id, name: selected.name, kind: selected.kind, as_of_date: selected.as_of_date },
    positions,
    posture_counts: {
      OVERWEIGHT: !empty && !isAlt ? 1 : 0,
      NEUTRAL: !empty && isAlt ? 1 : 0,
      UNDERWEIGHT: 0,
      UNKNOWN: 0,
    },
    position_count: positions.length,
    as_of: "2026-06-30",
    authority,
  };
};

const livePortfolio = {
  rows: [{
    issuer_id: "issuer-atlas",
    name: "Atlas Forge",
    ticker: "ATLF",
    sector: "Industrials",
    run_id: "run-atlas",
    qa_status: "Restricted",
    committee_status: "Restricted",
    as_of: "2026-07-15",
    metrics: { net_leverage: 5.7, interest_coverage: 2.1 },
    rv_recommendation: "OVERWEIGHT",
    rv_percentile: 64,
    downside_fragility: "MODERATE",
    gaps: [{ sev: "high", doc: "Audited financials" }],
  }],
  issuer_count: 2,
  covered_count: 1,
};

const digest = {
  as_of: "2026-07-16T09:30:00Z",
  coverage: { issuers: 2, rated: 2, with_complete_run: 1 },
  stale_threshold_days: 7,
  stale: [{ issuer_id: "issuer-stale", name: "Stale Telecom", detail: "last run 14d ago" }],
  warf: 3210,
  warf_band: "B2",
  ccc_watch: [{ issuer_id: "issuer-ccc", name: "CCC Retail", detail: "Caa1 / CCC+" }],
  qa: {},
  activity_24h: { runs_completed: 3, runs_failed: 1 },
  freshness: {
    policy_version: "caos-freshness-v1",
    source_kind: "run",
    counts: { current: 1, due: 0, stale: 1, unknown: 0 },
    rows: [],
  },
};

const autonomyDraft = {
  status: "draft",
  ai_generated: true,
  ratified: false,
  export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED",
  generated_at: "2026-07-16T09:30:00Z",
  refreshing: false,
  summary: { n_sections: 1, n_claims: 1, n_deterministic_bullets: 0, n_anomalies: 1 },
  sections: [{
    issuer_id: "issuer-atlas",
    issuer_name: "Atlas Forge",
    max_severity: 0.9,
    claims: [{
      text: "EBITDA margin compressed sharply vs peers",
      claim_type: "anomaly",
      anomaly_kind: "peer-outlier",
      anomaly_severity: 0.9,
      chunk_ids: [],
      fact_ids: [],
      model: "test-model",
    }],
    deterministic_bullets: [],
    exhibit: [],
  }],
};

const restoredInsight = {
  id: "insight-restored",
  context_id: "dynamic",
  surface: "command",
  kind: "decision-brief",
  status: "ready",
  subject_refs: {},
  summary: "Restored committee brief",
  claims: [{ id: "claim-1", statement: "Leverage remains elevated", evidence_ids: ["E-101"], numeric_facts: [] }],
  recommended_actions: [],
  missing_dependencies: [],
  authority,
  source_fingerprint: "restored",
  version: 1,
  model: "test-model",
  generated_at: "2026-07-16T09:30:00Z",
  ratified_at: null,
  rejected_at: null,
  lease_owner: null,
  lease_expires_at: null,
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function installCommandFixtures(
  page: Page,
  options: {
    mode?: CommandMode;
    emptySnapshot?: boolean;
    livePortfolioError?: boolean;
    restoredBrief?: boolean;
  } = {},
) {
  let mode: CommandMode = options.mode ?? "ready";
  let snapshotHits = 0;
  let lastInsightPost: Record<string, unknown> | null = null;
  let contextRevision = 1;

  await page.route(
    (url) => url.pathname === "/api/portfolios/",
    async (route) => {
      if (mode === "directory-error") await fulfillJson(route, { detail: "directory offline" }, 503);
      else await fulfillJson(route, portfolios);
    },
  );
  await page.route(
    (url) => /^\/api\/portfolios\/[^/]+\/command$/.test(url.pathname),
    async (route) => {
      snapshotHits += 1;
      const portfolioId = new URL(route.request().url()).pathname.split("/")[3];
      await fulfillJson(route, snapshot(portfolioId, Boolean(options.emptySnapshot)));
    },
  );
  await page.route(
    (url) => url.pathname === "/api/portfolio",
    async (route) => {
      if (options.livePortfolioError) await fulfillJson(route, { detail: "coverage offline" }, 503);
      else await fulfillJson(route, livePortfolio);
    },
  );
  await page.route((url) => url.pathname === "/api/digest/daily", (route) => fulfillJson(route, digest));
  await page.route((url) => url.pathname === "/api/qa/findings", (route) => fulfillJson(route, [{
    id: "qa-row-1",
    finding_id: "QA-1",
    run_id: "run-atlas",
    issuer_id: "issuer-atlas",
    issuer: "Atlas Forge",
    ticker: "ATLF",
    module_id: "CP-5",
    severity: "CRITICAL",
    lane: 1,
    description: "Material source gap",
    affected_claim_id: null,
    required_remediation: "Vault audited financials",
    as_of: "2026-07-15",
  }]));
  await page.route((url) => url.pathname === "/api/autonomy/draft", (route) => fulfillJson(route, autonomyDraft));
  await page.route(
    (url) => url.pathname === "/api/alerts/state",
    async (route) => {
      if (route.request().method() === "GET") await fulfillJson(route, []);
      else await fulfillJson(route, {
        id: "alert-state-1",
        alert_key: "fixture",
        state: "ack",
        assignee: null,
        note: null,
        analyst_id: "analyst",
        created_at: "2026-07-16T09:31:00Z",
        resolved_at: null,
        resolution_note: null,
      });
    },
  );
  await page.route(
    (url) => /^\/api\/analysis\/contexts\/[^/]+\/insights$/.test(url.pathname),
    async (route) => {
      if (route.request().method() === "GET") {
        await fulfillJson(route, {
          items: options.restoredBrief ? [restoredInsight] : [],
          current: options.restoredBrief ? restoredInsight : null,
          next_cursor: null,
        });
        return;
      }
      lastInsightPost = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        ...restoredInsight,
        id: "insight-refreshed",
        summary: "Refreshed cited decision brief",
        claims: [{ id: "claim-2", statement: "Coverage has weakened", evidence_ids: ["E-202"], numeric_facts: [] }],
        source_fingerprint: "refreshed",
        version: 2,
      });
    },
  );
  await page.route(
    (url) => /^\/api\/analysis\/contexts\/[^/]+$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      contextRevision += 1;
      await fulfillJson(route, {
        id: new URL(route.request().url()).pathname.split("/").at(-1),
        revision: contextRevision,
        name: "Portfolio command",
        sector_id: null,
        sub_segments: [],
        issuer_ids: [],
        instrument_ids: [],
        portfolio_scope: requestBody.portfolio_scope ?? null,
        as_of: null,
        sector_review_run_id: null,
        rv_snapshot_id: null,
        rv_run_id: null,
        query_session_id: null,
        artifacts: {
          issuer_run_id: null,
          source_manifest_id: null,
          research_job_id: null,
          model_checkpoint_id: null,
          report_version_id: null,
          alert_event_id: null,
          sponsor_id: null,
          portfolio_id: null,
          decision_id: null,
          insight_id: null,
          artifact_refs: [],
        },
        surface_state: requestBody.surface_state ?? {},
        filters: {},
        selected: {},
        created_at: "2026-07-16T09:30:00Z",
        updated_at: "2026-07-16T09:31:00Z",
      });
    },
  );

  return {
    getSnapshotHits: () => snapshotHits,
    getLastInsightPost: () => lastInsightPost,
    setMode: (next: CommandMode) => { mode = next; },
  };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test.describe("Command Center — current persisted workbench", () => {
  test("command-10 command-12 command-13 command-14 command-15 command-16 command-17 command-19 command-20 command-41 command-42 command-43 command-44 command-45 command-46 command-56 coordinates portfolio, decisions, and navigation", async ({ page }) => {
    const fixtures = await installCommandFixtures(page);
    const contextPatchResponse = page.waitForResponse((response) =>
      response.request().method() === "PATCH" && /^\/api\/analysis\/contexts\/[^/]+$/.test(new URL(response.url()).pathname),
    );
    await page.goto("/command/?portfolio=portfolio-qa");

    const selector = page.getByLabel("Selected portfolio");
    await expect(selector).toHaveValue("portfolio-qa", { timeout: 15000 });
    await expect(page.getByText("Credit Opportunities I", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("CLO · persisted", { exact: true })).toBeVisible();
    await expect(page.getByText("1/2", { exact: true }).first()).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "Command dataset" });
    await expect(tabs.getByRole("tab", { name: "Live coverage" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("5.7x", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Restricted", { exact: true }).first()).toBeVisible();

    await expect(page.getByText("What changed", { exact: true })).toBeVisible();
    await expect(page.getByText(/3 runs completed/)).toBeVisible();
    await expect(page.getByText(/WARF 3210 \(B2\) · CCC watch 1/)).toBeVisible();
    await expect(page.getByText(/1 QA findings · 1 source gaps/)).toBeVisible();
    await expect(page.getByText(/1 stale · 0 due · 0 unknown · 1 current/)).toBeVisible();

    const query = page.getByRole("link", { name: "Open cross-issuer Query" });
    await expect(query).toHaveAttribute("href", /\/query\?context=/);
    await page.getByRole("button", { name: "Open Command utilities" }).click();
    const utilities = page.getByRole("dialog", { name: "Command utilities" });
    await expect(utilities.getByRole("link", { name: "Open Portfolio Lab" })).toHaveAttribute("href", "/portfolios");
    await expect(utilities.getByRole("link", { name: "Open Monitor" })).toHaveAttribute("href", /\/monitor\?context=/);
    await page.keyboard.press("Escape");

    await tabs.getByRole("tab", { name: "Positions" }).click();
    await expect(page).toHaveURL(/dataset=positions/);
    const positionRow = page.getByRole("row", { name: /Atlas Forge position details/ });
    await positionRow.click();
    await expect(page).toHaveURL(/selected=position-atlas/);
    await expect(page.getByRole("link", { name: "Open Deep-Dive" })).toHaveAttribute(
      "href",
      "/deepdive?issuer=issuer-atlas&run=run-atlas",
    );
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page).not.toHaveURL(/selected=/);

    await selector.selectOption("portfolio-alt");
    await expect(page).toHaveURL(/portfolio=portfolio-alt/);
    await expect(page.getByText("Alternative Sleeve", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("row", { name: /Borealis Metals position details/ })).toBeVisible();
    const beforeFocus = fixtures.getSnapshotHits();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(fixtures.getSnapshotHits).toBeGreaterThan(beforeFocus);

    await page.getByRole("button", { name: "Open top change" }).click();
    await expect(page).toHaveURL(/\/deepdive\/?\?issuer=issuer-atlas(?:&|$)/);

    const patchResponse = await contextPatchResponse;
    expect(patchResponse.status()).toBe(200);
    const patch = patchResponse.request();
    const patchBody = patch.postDataJSON() as { portfolio_scope?: string; surface_state?: { command?: { view?: string; filters?: Record<string, unknown> } } };
    expect(patchBody.portfolio_scope).toBe("portfolio-qa");
    expect(patchBody.surface_state?.command?.filters?.portfolio_id).toBe("portfolio-qa");
  });

  test("command-11 command-18 command-21 command-22 preserves explicit invalid, offline, and empty states without sample substitution", async ({ page }) => {
    const fixtures = await installCommandFixtures(page, {
      mode: "directory-error",
      emptySnapshot: true,
      livePortfolioError: true,
    });

    await page.goto("/command/?dataset=positions");
    await expect(page.getByText("Portfolio directory unavailable", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/No sample sleeve has been substituted/)).toBeVisible();
    await expect(page.getByText("Live coverage unavailable", { exact: true }).first()).toBeVisible();

    fixtures.setMode("invalid-request");
    await page.goto("/command/?dataset=positions&portfolio=missing-portfolio");
    await expect(page.getByText("Portfolio unavailable", { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Open default portfolio" }).click();
    await expect(page).toHaveURL(/portfolio=portfolio-qa/);
    await expect(page.getByText("No positions held", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add holdings" })).toHaveAttribute("href", "/portfolios?portfolio=portfolio-qa");
  });

  test("command-54 command-55 restores and refreshes the current cited decision brief", async ({ page }) => {
    const fixtures = await installCommandFixtures(page, { restoredBrief: true });
    await page.goto("/command/?portfolio=portfolio-qa");

    await expect(page.getByText("Restored committee brief", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Leverage remains elevated · sources E-101/)).toBeVisible();
    await page.getByRole("button", { name: "Refresh cited brief" }).click();
    await expect(page.getByText("Refreshed cited decision brief", { exact: true })).toBeVisible();
    await expect(page.getByText(/Coverage has weakened · sources E-202/)).toBeVisible();
    await expect.poll(fixtures.getLastInsightPost).toMatchObject({
      surface: "command",
      kind: "decision-brief",
      force: true,
    });
  });

  test("all Command datasets remain operable without document overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installCommandFixtures(page);
    await page.goto("/command/?portfolio=portfolio-qa");

    const tabs = page.getByRole("tablist", { name: "Command dataset" });
    await expect(tabs.getByRole("tab", { name: "Live coverage" })).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
    await expect(page.getByRole("row", { name: /ATLF Atlas Forge details/ })).toBeVisible();
    await expectNoDocumentOverflow(page);

    await tabs.getByRole("tab", { name: "Positions" }).click();
    const positionRow = page.getByRole("row", { name: /Atlas Forge position details/ });
    await expect(positionRow).toBeVisible();
    await positionRow.click();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Deep-Dive" })).toHaveAttribute(
      "href",
      "/deepdive?issuer=issuer-atlas&run=run-atlas",
    );
    await page.getByRole("button", { name: "Close" }).click();
    await expectNoDocumentOverflow(page);

    await tabs.getByRole("tab", { name: "Changes" }).click();
    await expect(page.getByText("EBITDA margin compressed sharply vs peers", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ack" })).toBeVisible();
    await expectNoDocumentOverflow(page);

    await tabs.getByRole("tab", { name: "Governance" }).click();
    await expect(page.getByText("QA Queue · CP-5 open findings", { exact: true })).toBeVisible();
    await expect(page.getByText("Overdue Refresh · never run", { exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page);

    await page.getByRole("button", { name: "Open Command utilities" }).click();
    const utilities = page.getByRole("dialog", { name: "Command utilities" });
    await expect(utilities.getByRole("link", { name: "Open Portfolio Lab" })).toBeVisible();
    await expect(utilities.getByRole("link", { name: "Open Monitor" })).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
});
