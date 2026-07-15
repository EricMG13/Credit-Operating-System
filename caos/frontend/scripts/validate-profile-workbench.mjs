import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/private/tmp/caos-profile-workbench";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
];
const tabs = [
  ["Snapshot", "snapshot", "Credit snapshot"],
  ["Financials", "financials", "Financial & credit trend"],
  ["Structure & Covenant", "structure", "Business profile"],
  ["Market & RV", "market", "Market · price & DM"],
  ["Events", "events", "Latest earnings"],
  ["Evidence / QA", "evidence", "QA findings"],
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext();
await installSurfaceStubs(context, {
  id: "profile-verifier",
  email: "profile@local.dev",
  full_name: "Profile Verifier",
  role: "analyst",
  is_active: true,
  source: "local",
});
const page = await context.newPage();
const results = [];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE}/issuers/profile?id=iss-1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="persona-workbench"]').waitFor({ state: "visible" });
  await page.getByRole("tab", { name: "Snapshot" }).waitFor({ state: "visible" });

  let tabStatePreserved = true;
  for (const [label, id, heading] of tabs) {
    await page.getByRole("tab", { name: label }).click();
    await page.getByRole("heading", { name: new RegExp(heading, "i") }).waitFor({ state: "visible" });
    const url = new URL(page.url());
    tabStatePreserved &&= url.searchParams.get("id") === "iss-1";
    tabStatePreserved &&= id === "snapshot" ? !url.searchParams.has("tab") : url.searchParams.get("tab") === id;
  }

  await page.getByRole("tab", { name: "Snapshot" }).click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));

  let drawerFocusRestored = true;
  if (viewport.width < 1100) {
    const trigger = page.getByRole("button", { name: "Open evidence inspector drawer" });
    await trigger.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    drawerFocusRestored = await trigger.evaluate((element) => document.activeElement === element);
  }

  const metrics = await page.evaluate(() => {
    const decision = document.querySelector('.persona-workbench__slot--decision')?.getBoundingClientRect();
    const primary = document.querySelector('.persona-workbench__slot--primary')?.getBoundingClientRect();
    const owners = Array.from(document.querySelectorAll('[data-caos-dominant-table-owner]')).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const visibleSections = Array.from(document.querySelectorAll('[role="tabpanel"] > section')).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    return {
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      tableOwners: owners.length,
      visibleSections: visibleSections.length,
      decisionBottom: decision?.bottom ?? null,
      primaryTop: primary?.top ?? null,
      overlap: Boolean(decision && primary && decision.bottom > primary.top + 1),
    };
  });
  await page.screenshot({ path: `${OUT}/profile-${viewport.name}.png`, fullPage: false });
  results.push({ viewport: viewport.name, drawerFocusRestored, tabStatePreserved, ...metrics });
}

await browser.close();
const failures = results.filter((result) => result.documentOverflow || result.tableOwners > 1 || result.visibleSections !== 1 || result.overlap || !result.drawerFocusRestored || !result.tabStatePreserved);
console.log(JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
