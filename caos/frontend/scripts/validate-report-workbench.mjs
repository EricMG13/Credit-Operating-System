import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";
import { readWorkbenchMetrics } from "./workbench-browser-metrics.mjs";
import { WORKBENCH_VIEWPORTS } from "./workbench-validation.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/private/tmp/caos-report-workbench";
const identity = {
  id: "report-verifier",
  email: "report@local.dev",
  full_name: "Report Verifier",
  role: "analyst",
  is_active: true,
  source: "local",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext();
const unhandledApi = [];

// Install the fail-closed catch-all first. Playwright gives the later,
// route-specific fixtures precedence, so any request that reaches this handler
// is an explicit fixture gap rather than a silent developer-API fallthrough.
await context.route("**/api/**", async (route) => {
  unhandledApi.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
  await route.fulfill({
    status: 599,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Unhandled Report Studio validation fixture" }),
  });
});
await installSurfaceStubs(context, identity);
const emptyVersions = (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: "[]",
});
await context.route("**/api/reports/versions", emptyVersions);
await context.route("**/api/reports/versions?**", emptyVersions);

const page = await context.newPage();
const results = [];
const pageErrors = [];
const consoleErrors = [];
const failedResponses = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.request().method()} ${response.request().resourceType()} ${new URL(response.url()).pathname} referer=${response.request().headers().referer ?? "none"}`);
});

try {
  for (const viewport of WORKBENCH_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const navigationResponse = await page.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });

    try {
      await page.locator('[data-testid="persona-workbench"]').waitFor({ state: "visible" });
    } catch (error) {
      console.error(JSON.stringify({
        viewport: viewport.name,
        url: page.url(),
        body: (await page.locator("body").innerText()).slice(0, 1_000),
        unhandledApi,
        pageErrors,
        consoleErrors,
        failedResponses,
      }, null, 2));
      throw error;
    }
    await page.getByRole("heading", { name: "Report Studio", level: 1 }).waitFor({ state: "visible" });
    await page.getByLabel("Report preview").waitFor({ state: "visible" });
    await page.waitForURL(/(?:\?|&)context=context-1(?:&|$)/);
    await page.getByLabel("Report preview").locator('[aria-busy="false"]').first().waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const fixedProbe = document.createElement("div");
      fixedProbe.className = "fixed";
      document.body.append(fixedProbe);
      const position = getComputedStyle(fixedProbe).position;
      fixedProbe.remove();
      return position === "fixed";
    });
    const stylesheetState = await page.evaluate(() => {
      const fixedProbe = document.createElement("div");
      fixedProbe.className = "fixed";
      document.body.append(fixedProbe);
      const fixedPosition = getComputedStyle(fixedProbe).position;
      fixedProbe.remove();
      return {
        links: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => ({ href: link.getAttribute("href"), sheet: Boolean(link.sheet) })),
        sheets: Array.from(document.styleSheets).map((sheet) => ({ href: sheet.href, ruleCount: (() => {
          try { return sheet.cssRules.length; } catch { return -1; }
        })() })),
        fixedPosition,
        readyState: document.readyState,
      };
    });
    assert(stylesheetState.fixedPosition === "fixed", `${viewport.name}: fixed-position utility CSS is unavailable (${JSON.stringify(stylesheetState)})`);
    const creditSnapshot = page.getByRole("button", { name: /Credit Snapshot/ });
    if (await creditSnapshot.count() === 0) {
      await page.getByRole("button", { name: "Deliverables" }).click();
    }
    try {
      await creditSnapshot.waitFor({ state: "visible", timeout: 10_000 });
    } catch (error) {
      console.error(JSON.stringify({
        viewport: viewport.name,
        url: page.url(),
        body: (await page.locator("body").innerText()).slice(0, 2_000),
        buttons: await page.getByRole("button").allTextContents(),
        unhandledApi,
        pageErrors,
        consoleErrors,
        failedResponses,
      }, null, 2));
      throw error;
    }
    assert(await page.getByRole("button", { name: /Credit Snapshot|Earnings Update|IC Credit Memo|Covenant & Capacity Brief|Monitoring Digest|Model Appendix/ }).count() === 6, `${viewport.name}: expected six deliverables`);

    const utilityTrigger = page.getByRole("button", { name: "Open Report utilities" });
    const utilityScrollBeforeReset = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollTo(0, 0));
    const utilityTriggerGeometry = await utilityTrigger.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        scrollY: window.scrollY,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
      };
    });
    assert(utilityTriggerGeometry.top >= -2 && utilityTriggerGeometry.bottom <= utilityTriggerGeometry.viewportHeight + 2, `${viewport.name}: report utility trigger must remain in the viewport (${JSON.stringify(utilityTriggerGeometry)})`);
    await utilityTrigger.click();
    const utilityDialog = page.getByRole("dialog", { name: "Report utilities" });
    await utilityDialog.waitFor({ state: "visible" });
    const utilityGeometry = await utilityDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        position: style.position,
        overflowY: style.overflowY,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        scrollY: window.scrollY,
      };
    });
    const utilityControls = [
      ["Paper tone White", utilityDialog.getByRole("button", { name: "Paper tone White" })],
      ["SOURCES", utilityDialog.getByRole("button", { name: "SOURCES" })],
      ["EDIT DOCUMENT", utilityDialog.getByRole("button", { name: "EDIT DOCUMENT" })],
      ["FIT", utilityDialog.getByRole("button", { name: "FIT" })],
      ["Print / save PDF", utilityDialog.getByRole("button", { name: "Print / save PDF" })],
      ["Download PDF", utilityDialog.getByRole("button", { name: "Download PDF" })],
    ];
    try {
      for (const [name, control] of utilityControls) {
        assert(await control.count() === 1, `${viewport.name}: expected one ${name} control`);
        await control.waitFor({ state: "visible" });
      }
    } catch (error) {
      console.error(JSON.stringify({
        viewport: viewport.name,
        utilityAttached: await utilityDialog.count(),
        utilityText: await utilityDialog.allInnerTexts(),
        utilityButtons: await utilityDialog.getByRole("button").allTextContents(),
        utilityGeometry,
        utilityScrollBeforeReset,
        utilityTriggerGeometry,
        navigationStatus: navigationResponse?.status() ?? null,
        stylesheetState,
        scrollY: await page.evaluate(() => window.scrollY),
      }, null, 2));
      throw error;
    }
    assert(utilityGeometry.position === "fixed", `${viewport.name}: utility drawer must remain fixed (${JSON.stringify(utilityGeometry)})`);
    assert(utilityGeometry.top >= 0 && utilityGeometry.bottom <= utilityGeometry.viewportHeight, `${viewport.name}: utility drawer must fit vertically (${JSON.stringify(utilityGeometry)})`);
    assert(utilityGeometry.left >= 0 && utilityGeometry.right <= utilityGeometry.viewportWidth, `${viewport.name}: utility drawer must fit horizontally (${JSON.stringify(utilityGeometry)})`);
    assert(await utilityControls[4][1].isDisabled(), `${viewport.name}: mutable reference print should be disabled`);
    const downloadPdf = utilityDialog.getByRole("button", { name: "Download PDF" });
    assert(await downloadPdf.isDisabled(), `${viewport.name}: mutable reference download should be disabled`);
    await page.keyboard.press("Escape");
    await utilityDialog.waitFor({ state: "detached" });
    const utilityFocusRestored = await utilityTrigger.evaluate((element) => document.activeElement === element);

    if (await page.getByRole("option", { name: /^E-/ }).count() === 0) {
      await page.getByRole("button", { name: "Panels" }).click();
    }
    const vaultButton = page.getByRole("button", { name: /EXPORT TO VAULT/ });
    await vaultButton.waitFor({ state: "visible" });
    const composeToggle = page.getByRole("button", { name: /COMPANY PROFILE · RECOMMENDATION/ });
    await composeToggle.waitFor({ state: "visible" });
    assert(await composeToggle.getAttribute("aria-pressed") === "true", `${viewport.name}: compose section should start included`);

    const evidenceOption = page.getByRole("option", { name: /^E-/ }).first();
    await evidenceOption.click();
    const evidenceButton = page.getByRole("button", { name: /^Open source/ }).first();
    await evidenceButton.click();
    const evidenceDialog = page.getByRole("dialog", { name: /^Source evidence E-/ });
    await evidenceDialog.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await evidenceDialog.waitFor({ state: "detached" });
    const evidenceFocusRestored = await evidenceButton.evaluate((element) => document.activeElement === element);

    const metrics = await page.evaluate(readWorkbenchMetrics);
    const clippedControls = await page.getByRole("button").evaluateAll((buttons) => buttons
      .filter((button) => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left < -2 || rect.right > document.documentElement.clientWidth + 2;
      })
      .map((button) => {
        let ancestor = button.parentElement;
        let scrollOwner = null;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          if (["auto", "scroll"].includes(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 1) {
            scrollOwner = ancestor.getAttribute("aria-label") || ancestor.className || ancestor.tagName;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return {
          name: button.getAttribute("aria-label") || button.textContent?.trim() || "unnamed button",
          scrollOwner,
        };
      }));
    const horizontalClipping = clippedControls.filter((control) => !control.scrollOwner).map((control) => control.name);
    const scrollContainedControls = clippedControls.filter((control) => control.scrollOwner);
    await page.screenshot({ path: `${OUT}/reports-${viewport.name}.png`, fullPage: false });

    results.push({
      viewport: viewport.name,
      utilityFocusRestored,
      evidenceFocusRestored,
      horizontalClipping,
      scrollContainedControls,
      ...metrics,
    });
  }
} finally {
  await browser.close();
}

const failures = results.filter((result) => (
  result.documentOverflow
  || result.overlap
  || !result.utilityFocusRestored
  || !result.evidenceFocusRestored
  || result.horizontalClipping.length > 0
));
console.log(JSON.stringify({ results, unhandledApi, pageErrors, consoleErrors, failedResponses, failures }, null, 2));
if (unhandledApi.length || pageErrors.length || consoleErrors.length || failedResponses.length || failures.length) process.exitCode = 1;
