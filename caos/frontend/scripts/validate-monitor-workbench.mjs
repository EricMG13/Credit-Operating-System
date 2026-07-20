import { captureWorkbenchResult, createWorkbenchHarness, prepareWorkbenchViewport, verifyDrawerFocus, WORKBENCH_VIEWPORTS } from "./workbench-validation.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/private/tmp/caos-monitor-workbench";
const { browser, context } = await createWorkbenchHarness(OUT, {
  id: "monitor-verifier",
  email: "monitor@local.dev",
  full_name: "Monitor Verifier",
  role: "analyst",
  is_active: true,
  source: "local",
});
const page = await context.newPage();
const results = [];

for (const viewport of WORKBENCH_VIEWPORTS) {
  await prepareWorkbenchViewport(page, { viewport, url: `${BASE}/monitor?mode=reference&dataset=alerts`, tabName: "Replay", settleMs: 250 });

  const emailTab = page.getByRole("tab", { name: "Email intake" });
  await emailTab.click();
  await page.waitForURL(/dataset=email/);
  await page.getByRole("tab", { name: "Replay" }).click();
  await page.waitForURL(/dataset=alerts/);

  const drawerFocusRestored = await verifyDrawerFocus(page, viewport.width, ["Open context drawer", "Open evidence inspector drawer"]);

  results.push(await captureWorkbenchResult(page, { out: OUT, surface: "monitor", viewport, drawerFocusRestored }));
}

await browser.close();
const failures = results.filter((result) => result.documentOverflow || result.tableOwners !== 1 || result.overlap || !result.drawerFocusRestored);
console.log(JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
