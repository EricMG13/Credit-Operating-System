/**
 * Playwright E2E: versioned Sector Review dossier, governance, and narrow-mode
 * contracts. API routes use exact pathname predicates and a fail-closed
 * fallback so an unhandled request cannot silently hit a developer dataset.
 */

import { expect, test, type Page, type Route } from "@playwright/test";

const contextTemplate = {
  id: "sector-e2e-context",
  revision: 1,
  name: "Telecom sector dossier",
  sector_id: "telecom",
  sub_segments: [],
  issuer_ids: [],
  instrument_ids: [],
  portfolio_scope: null,
  as_of: "2026-07-18",
  sector_review_run_id: "sector-review-v2",
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
  surface_state: {},
  filters: {},
  selected: {},
  created_at: "2026-07-18T08:00:00Z",
  updated_at: "2026-07-18T08:00:00Z",
};

const authority = {
  origin: "live",
  method: "CP-SR adapter-v2",
  freshness: "current",
  as_of: "2026-07-18T08:00:00Z",
  source_ids: ["source-filing"],
  run_id: "sector-review-v2",
  version_id: "v2",
  confidence: 0.82,
  approval_state: "draft",
  analyst_override: null,
};

const currentReviewTemplate = {
  id: "sector-review-v2",
  context_id: contextTemplate.id,
  sector_id: "telecom",
  sector_label: "Telecom",
  timeframe: "weekly",
  version: 2,
  status: "ready",
  as_of: "2026-07-18T08:00:00Z",
  posture: "Cautious",
  what_changed: "Fiber pricing weakened while wireless demand held.",
  why_it_matters: "Refinancing headroom is narrowing for levered issuers.",
  required_action: "Ratify the pricing and demand sections before publication.",
  evidence_health: "3 live / 3 total signals",
  sections: [
    { id: "demand", title: "Demand", posture: "stable", summary: "Wireless demand remains stable.", confidence: 0.84, freshness: "current", signal_ids: ["signal-demand"] },
    { id: "pricing", title: "Pricing", posture: "weak", summary: "Fiber pricing weakened.", confidence: 0.76, freshness: "current", signal_ids: ["signal-pricing"] },
  ],
  dimension_scores: [
    { id: "demand-score", label: "Demand", score: 3.6, confidence: 0.84, freshness: "current", source_ids: ["source-filing"], missing_dependency: null },
  ],
  risks: [
    { id: "risk-refi", title: "Refinancing pressure", likelihood: "high", severity: "high", mitigants: ["Term out maturities"], residual_risk: "Elevated", source_ids: ["source-filing"] },
  ],
  comparables: [
    { issuer_id: "issuer-atlas", issuer_name: "Atlas Telecom", posture: "Cautious", metrics: { leverage: 5.8, spread_bps: 475 }, missing_dependencies: [] },
    { issuer_id: null, issuer_name: "Private Peer", posture: "Watch", metrics: { leverage: 6.4, spread_bps: 520 }, missing_dependencies: ["Audited EBITDA"] },
  ],
  early_warning: [
    { id: "warning-pricing", indicator: "Fiber price decline", threshold: "Below -5% YoY", current_state: "-7% YoY", status: "breached", source_ids: ["source-filing"] },
  ],
  source_register: [
    { id: "source-filing", title: "Atlas Q2 filing", origin: "live", method: "reported", freshness: "current", as_of: "2026-07-18", url: "https://example.test/atlas-q2" },
  ],
  uncertainties: [
    { id: "gap-ebitda", statement: "Private-peer EBITDA is unaudited.", impact: "Comparable leverage remains indicative.", route_to_qa: true, source_ids: [] },
  ],
  downstream_readiness: { ready: false, consumers: ["Query", "Monitor"], blocked_by: ["analyst ratification"] },
  missing_dependencies: [],
  authority,
  ratifications: {},
  created_at: "2026-07-18T08:00:00Z",
};

const priorReview = {
  ...currentReviewTemplate,
  id: "sector-review-v1",
  version: 1,
  posture: "Stable",
  as_of: "2026-07-11T08:00:00Z",
  authority: { ...authority, run_id: "sector-review-v1", version_id: "v1", approval_state: "published" },
  source_register: [],
  ratifications: { demand: "ratified", pricing: "ratified" },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function installSectorFixtures(page: Page) {
  let context = structuredClone(contextTemplate);
  let currentReview = structuredClone(currentReviewTemplate);
  let feeds = [
    { sector: "Telecom", enabled: true, notify_pref: "email", provenance: "profile" },
    { sector: "Software", enabled: true, notify_pref: "in_app", provenance: "profile" },
  ];
  const unexpectedApi: string[] = [];
  const hits = { history: 0, ratify: 0, publish: 0, feedPut: 0, contextPatch: 0 };

  // Registered first: Playwright resolves later matching routes first, leaving
  // this as a fail-closed oracle for any endpoint omitted below.
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.startsWith("/api/auth/")) {
      await route.continue();
      return;
    }
    unexpectedApi.push(`${route.request().method()} ${pathname}`);
    await fulfillJson(route, { detail: "Unhandled Sector Review E2E fixture request" }, 501);
  });

  await page.route((url) => url.pathname === "/api/settings/analyst", (route) =>
    fulfillJson(route, { model_lanes: {}, email_intelligence: {}, role_view: "analyst", workspace: {}, revision: 1 }));
  await page.route((url) => url.pathname === "/api/notifications", (route) =>
    fulfillJson(route, { items: [], next_cursor: null }));
  await page.route((url) => url.pathname === "/api/analysis/taxonomy", (route) =>
    fulfillJson(route, { sectors: [
      { id: "telecom", label: "Telecom", aliases: [] },
      { id: "software", label: "Software", aliases: ["technology"] },
    ] }));
  await page.route((url) => url.pathname === "/api/analysis/findings", (route) => fulfillJson(route, []));
  await page.route((url) => url.pathname === "/api/analysis/contexts", async (route) => {
    if (route.request().method() !== "POST") {
      unexpectedApi.push(`${route.request().method()} /api/analysis/contexts`);
      await fulfillJson(route, { detail: "Method not fixture-backed" }, 405);
      return;
    }
    await fulfillJson(route, context);
  });
  await page.route((url) => /^\/api\/analysis\/contexts\/[^/]+$/.test(url.pathname), async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await fulfillJson(route, context);
      return;
    }
    if (method === "PATCH") {
      hits.contextPatch += 1;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      context = { ...context, ...body, revision: context.revision + 1, updated_at: "2026-07-18T09:00:00Z" };
      await fulfillJson(route, context);
      return;
    }
    unexpectedApi.push(`${method} ${new URL(route.request().url()).pathname}`);
    await fulfillJson(route, { detail: "Method not fixture-backed" }, 405);
  });
  await page.route((url) => url.pathname === "/api/sector/feeds", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, feeds);
      return;
    }
    if (route.request().method() === "PUT") {
      hits.feedPut += 1;
      feeds = (route.request().postDataJSON() as { feeds: typeof feeds }).feeds;
      await fulfillJson(route, feeds);
      return;
    }
    unexpectedApi.push(`${route.request().method()} /api/sector/feeds`);
    await fulfillJson(route, { detail: "Method not fixture-backed" }, 405);
  });
  await page.route((url) => url.pathname === "/api/sector/reviews", async (route) => {
    if (route.request().method() === "GET") {
      hits.history += 1;
      await fulfillJson(route, [currentReview, priorReview]);
      return;
    }
    if (route.request().method() === "POST") {
      await fulfillJson(route, currentReview);
      return;
    }
    unexpectedApi.push(`${route.request().method()} /api/sector/reviews`);
    await fulfillJson(route, { detail: "Method not fixture-backed" }, 405);
  });
  await page.route((url) => /^\/api\/sector\/reviews\/[^/]+\/ratifications$/.test(url.pathname), async (route) => {
    hits.ratify += 1;
    const body = route.request().postDataJSON() as { sections: Array<{ section_id: string; decision: string }> };
    const ratifications = { ...currentReview.ratifications } as Record<string, string>;
    for (const item of body.sections) ratifications[item.section_id] = item.decision;
    const allRatified = currentReview.sections.every((section) => ratifications[section.id] === "ratified");
    currentReview = {
      ...currentReview,
      ratifications,
      authority: { ...currentReview.authority, approval_state: allRatified ? "ratified" : "draft" },
    };
    await fulfillJson(route, currentReview);
  });
  await page.route((url) => /^\/api\/sector\/reviews\/[^/]+\/publish$/.test(url.pathname), async (route) => {
    hits.publish += 1;
    currentReview = {
      ...currentReview,
      authority: { ...currentReview.authority, approval_state: "published" },
      downstream_readiness: { ...currentReview.downstream_readiness, ready: true, blocked_by: [] },
    };
    await fulfillJson(route, currentReview);
  });

  return { hits, unexpectedApi };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test.describe("Sector Review — versioned dossier governance", () => {
  test("command-29 command-30 command-31 command-47 command-48 command-49 command-50 command-51 command-57 completes the governed desktop journey", async ({ page }) => {
    const fixtures = await installSectorFixtures(page);
    await page.goto("/sector/?context=sector-e2e-context");

    await expect(page.getByText("Telecom · v2", { exact: true })).toBeVisible({ timeout: 15000 });
    for (const label of ["Overview", "Signals", "Comparables", "Early Warning", "Risks", "Sources"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Wireless demand remains stable.", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Blocked · analyst ratification/)).toBeVisible();

    await page.getByRole("button", { name: "Ratify section" }).click();
    await expect(page.getByRole("button", { name: "Ratified", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Ratify updates" }).click();
    await expect(page.getByText("Confirm ratification scope · Pricing", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm ratify 1 section" }).click();
    await page.getByRole("button", { name: "Publish review" }).click();
    await expect(page.getByText("published", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish review" })).toHaveCount(0);

    await page.getByRole("button", { name: "Open Review utilities" }).click();
    const utilities = page.getByRole("dialog", { name: "Review utilities" });
    await utilities.getByLabel("Compare version").selectOption("sector-review-v1");
    await expect(utilities.getByText(/v1 Stable → v2 Cautious\. Source count 0 → 1\./)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Comparables" }).click();
    await expect(page.getByRole("table", { name: "Sector comparables" })).toBeVisible();
    await expect(page.getByText("Audited EBITDA", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sources" }).click();
    await expect(page.getByText("Atlas Q2 filing", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Route gaps to QA" })).toHaveAttribute("href", /\/monitor\?context=sector-e2e-context&focus=source-gaps/);

    expect(fixtures.hits.history).toBe(1);
    expect(fixtures.hits.ratify).toBe(2);
    expect(fixtures.hits.publish).toBe(1);
    expect(fixtures.unexpectedApi).toEqual([]);
  });

  test("command-29 command-30 command-31 command-47 command-48 command-49 command-50 command-51 command-57 preserves narrow-mode capabilities and mutation ownership", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixtures = await installSectorFixtures(page);
    await page.goto("/sector/?context=sector-e2e-context");

    await expect(page.getByText("Telecom · v2", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("combobox", { name: "Active sector" })).toHaveValue("telecom");
    for (const label of ["Overview", "Signals", "Comparables", "Early Warning", "Risks", "Sources"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    }

    await page.getByRole("button", { name: "Open context drawer" }).click();
    const contextDrawer = page.getByRole("dialog", { name: "Context" });
    await expect(contextDrawer.getByRole("complementary", { name: "Canonical sectors" })).toBeVisible();
    await contextDrawer.getByRole("switch", { name: "Alerts on" }).first().click();
    await expect(contextDrawer.getByRole("switch", { name: "Alerts off" })).toBeVisible();
    await page.getByRole("button", { name: "Close context drawer" }).click();

    await page.getByRole("combobox", { name: "Active sector" }).selectOption("software");
    await expect(page.getByText("No versioned dossier", { exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page);

    expect(fixtures.hits.history).toBe(2);
    expect(fixtures.hits.feedPut).toBe(1);
    expect(fixtures.hits.contextPatch).toBe(1);
    expect(fixtures.unexpectedApi).toEqual([]);
  });
});
