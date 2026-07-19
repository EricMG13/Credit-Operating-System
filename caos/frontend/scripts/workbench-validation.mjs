import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";
import { readWorkbenchMetrics } from "./workbench-browser-metrics.mjs";

export const WORKBENCH_VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
];

export async function createWorkbenchHarness(out, identity) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await installSurfaceStubs(context, identity);
  return { browser, context };
}

export async function prepareWorkbenchViewport(page, { viewport, url, tabName, settleMs = 0 }) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="persona-workbench"]').waitFor({ state: "visible" });
  await page.getByRole("tab", { name: tabName }).waitFor({ state: "visible" });
  if (settleMs) await page.waitForTimeout(settleMs);
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function verifyDrawerFocus(page, viewportWidth, names) {
  if (viewportWidth >= 1100) return true;
  let restored = true;
  for (const name of names) {
    const trigger = page.getByRole("button", { name });
    await trigger.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    restored &&= await trigger.evaluate((element) => document.activeElement === element);
  }
  return restored;
}

export async function captureWorkbenchResult(page, { out, surface, viewport, drawerFocusRestored, extra = {} }) {
  const metrics = await page.evaluate(readWorkbenchMetrics);
  await page.screenshot({ path: `${out}/${surface}-${viewport.name}.png`, fullPage: false });
  return { viewport: viewport.name, drawerFocusRestored, ...extra, ...metrics };
}
