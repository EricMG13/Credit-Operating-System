import { captureWorkbenchResult, createWorkbenchHarness, prepareWorkbenchViewport, verifyDrawerFocus, WORKBENCH_VIEWPORTS } from "./workbench-validation.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/private/tmp/caos-profile-workbench";
const tabs = [
  ["Snapshot", "snapshot", "Credit snapshot"],
  ["Financials", "financials", "Financial & credit trend"],
  ["Structure & Covenant", "structure", "Business profile"],
  ["Market & RV", "market", "Market · price & DM"],
  ["Events", "events", "Latest earnings"],
  ["Evidence / QA", "evidence", "QA findings"],
];

const { browser, context } = await createWorkbenchHarness(OUT, {
  id: "profile-verifier",
  email: "profile@local.dev",
  full_name: "Profile Verifier",
  role: "analyst",
  is_active: true,
  source: "local",
});
const page = await context.newPage();
const results = [];

for (const viewport of WORKBENCH_VIEWPORTS) {
  await prepareWorkbenchViewport(page, { viewport, url: `${BASE}/issuers/profile?id=iss-1`, tabName: "Snapshot" });

  let tabStatePreserved = true;
  for (const [label, id, heading] of tabs) {
    await page.getByRole("tab", { name: label }).click();
    await page.getByRole("heading", { name: heading, exact: false }).waitFor({ state: "visible" });
    const url = new URL(page.url());
    tabStatePreserved &&= url.searchParams.get("id") === "iss-1";
    tabStatePreserved &&= id === "snapshot" ? !url.searchParams.has("tab") : url.searchParams.get("tab") === id;
  }

  await page.getByRole("tab", { name: "Snapshot" }).click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));

  const drawerFocusRestored = await verifyDrawerFocus(page, viewport.width, ["Open evidence inspector drawer"]);

  results.push(await captureWorkbenchResult(page, { out: OUT, surface: "profile", viewport, drawerFocusRestored, extra: { tabStatePreserved } }));
}

await browser.close();
const failures = results.filter((result) => [result.documentOverflow, result.tableOwners > 1, result.visibleSections !== 1, result.overlap, !result.drawerFocusRestored, !result.tabStatePreserved].some(Boolean));
console.log(JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
