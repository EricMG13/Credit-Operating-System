import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/private/tmp/caos-monitor-workbench";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext();
await installSurfaceStubs(context, {
  id: "monitor-verifier",
  email: "monitor@local.dev",
  full_name: "Monitor Verifier",
  role: "analyst",
  is_active: true,
  source: "local",
});
const page = await context.newPage();
const results = [];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE}/monitor?dataset=alerts`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="persona-workbench"]').waitFor({ state: "visible" });
  await page.getByRole("tab", { name: "Alerts" }).waitFor({ state: "visible" });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));

  const emailTab = page.getByRole("tab", { name: "Email intake" });
  await emailTab.click();
  await page.waitForURL(/dataset=email/);
  await page.getByRole("tab", { name: "Alerts" }).click();
  await page.waitForURL(/dataset=alerts/);

  let drawerFocusRestored = true;
  if (viewport.width < 1100) {
    for (const name of ["Open context drawer", "Open evidence inspector drawer"]) {
      const trigger = page.getByRole("button", { name });
      await trigger.click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      drawerFocusRestored &&= await trigger.evaluate((element) => document.activeElement === element);
    }
  }

  const metrics = await page.evaluate(() => {
    const decision = document.querySelector('.persona-workbench__slot--decision')?.getBoundingClientRect();
    const primary = document.querySelector('.persona-workbench__slot--primary')?.getBoundingClientRect();
    const owners = Array.from(document.querySelectorAll('[data-caos-dominant-table-owner]')).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    return {
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      tableOwners: owners.length,
      decisionBottom: decision?.bottom ?? null,
      primaryTop: primary?.top ?? null,
      overlap: Boolean(decision && primary && decision.bottom > primary.top + 1),
      scrollY: window.scrollY,
    };
  });
  await page.screenshot({ path: `${OUT}/monitor-${viewport.name}.png`, fullPage: false });
  results.push({ viewport: viewport.name, drawerFocusRestored, ...metrics });
}

await browser.close();
const failures = results.filter((result) => result.documentOverflow || result.tableOwners !== 1 || result.overlap || !result.drawerFocusRestored);
console.log(JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
