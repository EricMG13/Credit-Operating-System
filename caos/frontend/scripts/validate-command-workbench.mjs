import { captureWorkbenchResult, createWorkbenchHarness, prepareWorkbenchViewport, verifyDrawerFocus, WORKBENCH_VIEWPORTS } from "./workbench-validation.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/private/tmp/caos-command-workbench";
const { browser, context } = await createWorkbenchHarness(OUT, {
  id: "command-verifier",
  email: "command@local.dev",
  full_name: "Command Verifier",
  role: "analyst",
  is_active: true,
  source: "local",
});
await context.route("**/api/portfolio", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [], issuer_count: 1, covered_count: 0 }) }));
await context.route("**/api/digest/daily", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ as_of: "2026-07-13T10:00:00Z", coverage: { issuers: 1, rated: 1, unrated: 0, with_complete_run: 0 }, stale_threshold_days: 30, stale: [], warf: 2900, warf_band: "B", ccc_watch: [], qa: {}, activity_24h: {} }) }));
await context.route("**/api/autonomy/draft**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ready", ai_generated: false, ratified: false, export_allowed: false, marking: "WATCHTOWER DRAFT", generated_at: "2026-07-13T10:00:00Z", sections: [], summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 }, refreshing: false }) }));
await context.route("**/api/alert-states**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await context.route("**/api/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], next_cursor: null }) }));
await context.route("**/api/portfolios/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "portfolio-1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-07-13", n_positions: 1, total_nav: 98500000, total_par: 100000000, breaches: 0, watches: 0 }]) }));
await context.route("**/api/portfolios/portfolio-1/command", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  portfolio: { id: "portfolio-1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-07-13" },
  positions: [{ id: "position-1", portfolio_id: "portfolio-1", issuer_id: "iss-1", borrower_name: "Atlas Forge", ticker: "ATLF", figi: "BBG000000001", loan_name: "First Lien Term Loan", sector: "Industrials", sub_sector: null, ranking: "1L", rating_moody: "B2", rating_sp: "B", par_usd: 100000000, facility_musd: 500, margin_bps: 475, maturity: "2031-06-30", price: 98.5, ytm: null, dm: null, market_value: 98500000, created_at: "2026-07-13T10:00:00Z", posture: "NEUTRAL", run_id: "run-1", qa_status: "Passed", committee_status: "Committee Ready" }],
  position_count: 1,
  posture_counts: { OVERWEIGHT: 0, NEUTRAL: 1, UNDERWEIGHT: 0, UNKNOWN: 0 },
  as_of: "2026-07-13", authority: { method: "portfolio-command-v1", source_ids: ["portfolio:p1", "run:run-1"] },
}) }));

const page = await context.newPage();
const results = [];

for (const viewport of WORKBENCH_VIEWPORTS) {
  await prepareWorkbenchViewport(page, { viewport, url: `${BASE}/command?dataset=coverage`, tabName: "Live coverage" });

  let urlStatePreserved = true;
  for (const [label, dataset] of [["Changes", "changes"], ["Positions", "positions"], ["Governance", "governance"], ["Live coverage", "coverage"]]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("dataset") === dataset);
    urlStatePreserved &&= new URL(page.url()).searchParams.get("dataset") === dataset;
  }
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));

  const drawerFocusRestored = await verifyDrawerFocus(page, viewport.width, ["Open context drawer", "Open evidence inspector drawer"]);

  results.push(await captureWorkbenchResult(page, { out: OUT, surface: "command", viewport, drawerFocusRestored, extra: { urlStatePreserved } }));
}

await browser.close();
const failures = results.filter((result) => [result.documentOverflow, result.tableOwners !== 1, result.overlap, !result.drawerFocusRestored, !result.urlStatePreserved].some(Boolean));
console.log(JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
