import { chromium } from "playwright";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const base = process.env.BASE || "http://127.0.0.1:4176";
const evidenceDir = process.env.EVIDENCE_DIR || "/private/tmp/caos-task4c-workflows";
const evidenceJson = process.env.EVIDENCE_JSON || `${evidenceDir}/evidence.json`;
const requestedSurfaces = new Set((process.env.TASK4C_SURFACES || "pipeline,monitor,settings").split(",").map((surface) => surface.trim()).filter(Boolean));
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function tabTo(page, locator, label, limit = 180) {
  await locator.waitFor({ state: "visible" });
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard focus did not reach ${label} within ${limit} Tab presses`);
}

async function audit(page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => (await window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  })).violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, targets: violation.nodes.slice(0, 12).map((node) => ({ target: node.target, html: node.html })) })));
  const layout = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const scrollOwned = (element) => {
      for (let owner = element.parentElement; owner && owner !== document.body; owner = owner.parentElement) {
        const style = getComputedStyle(owner);
        if (/(auto|scroll)/.test(style.overflowX) && owner.scrollWidth > owner.clientWidth + 1) return true;
      }
      return false;
    };
    const clippedControls = Array.from(document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])"))
      .filter(visible)
      .filter((element) => !element.matches(":disabled,[aria-disabled='true']"))
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return (rect.left >= -1 && rect.right <= innerWidth + 1) || scrollOwned(element)
          ? []
          : [{ label: (element.getAttribute("aria-label") || element.textContent || element.tagName).trim().replace(/\s+/g, " ").slice(0, 100), left: Math.round(rect.left), right: Math.round(rect.right) }];
      });
    return { documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, clippedControls };
  });
  assert(violations.length === 0, `axe violations: ${JSON.stringify(violations)}`);
  assert(layout.documentOverflow <= 1, `document overflow: ${layout.documentOverflow}px`);
  assert(layout.clippedControls.length === 0, `clipped controls: ${JSON.stringify(layout.clippedControls)}`);
  return { violations, layout };
}

await mkdir(evidenceDir, { recursive: true });
await mkdir(dirname(evidenceJson), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: viewports[0], bypassCSP: true });
page.setDefaultTimeout(20_000);
const httpFailures = [];
page.on("response", (response) => {
  if (response.status() >= 400) httpFailures.push({ status: response.status(), url: response.url() });
});
await installSurfaceStubs(page, {
  id: "task4c-workflow", email: "task4c-workflow@local.dev", full_name: "Task 4C Workflow Gate",
  role: "analyst", role_view: "qa", is_active: true, source: "local",
});

const results = [];
const reducedMotionResults = [];
let fixtureIdentity = null;
for (const viewport of viewports) {
  await page.setViewportSize(viewport);

  let failureStart;
  if (requestedSurfaces.has("pipeline")) {
  failureStart = httpFailures.length;
  await page.goto(`${base}/pipeline?mode=reference`, { waitUntil: "domcontentloaded" });
  await page.getByRole("table", { name: "Ordered pipeline stages and modules" }).waitFor();
  const fundamental = page.getByTitle(/Fundamental Credit — Enter to select/);
  await tabTo(page, fundamental, "Fundamental Credit graph node");
  await page.keyboard.press("Enter");
  assert(await fundamental.getAttribute("aria-pressed") === "true", "Pipeline keyboard selection did not activate CP-2");
  const selectedTableRow = page.locator('table[aria-label="Ordered pipeline stages and modules"] tr[aria-current="true"]');
  assert((await selectedTableRow.textContent())?.includes("Fundamental Credit"), "Pipeline table did not mirror graph selection");
  assert(await page.getByText("Output & persistence", { exact: true }).first().isVisible(), "Final ordered stage is not visible");
  if (!fixtureIdentity) fixtureIdentity = await page.evaluate(() => fetch("/api/auth/me").then((response) => response.json()));
  assert(fixtureIdentity.id === "task4c-workflow" && fixtureIdentity.source === "local", `Unexpected fixture identity: ${JSON.stringify(fixtureIdentity)}`);
  const pipelineAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/pipeline-populated-${viewport.width}x${viewport.height}.png`, fullPage: false });
  results.push({ route: "/pipeline?mode=reference", viewport, state: "CP-2 selected by keyboard; ordered stage table mirrors selection", httpFailures: httpFailures.slice(failureStart), ...pipelineAudit });
  }

  if (requestedSurfaces.has("monitor")) {
  failureStart = httpFailures.length;
  await page.goto(`${base}/monitor`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Governance" }).waitFor();
  assert(await page.getByRole("tab", { name: "Governance" }).getAttribute("aria-selected") === "true", "QA Monitor did not lead with Governance");
  const monitorComposition = await page.locator('[data-testid="persona-workbench"]').evaluate((element) => ({
    persona: element.getAttribute("data-persona"),
    emphasized: element.getAttribute("data-dominant-representation"),
    slotNames: Array.from(element.querySelectorAll('[data-slot]')).map((slot) => slot.getAttribute('data-slot')),
  }));
  assert(monitorComposition.persona === "qa", `Monitor persona drifted before responsive assertion: ${JSON.stringify(monitorComposition)}`);
  assert(monitorComposition.slotNames.includes("inspector"), `QA inspector was removed from the visible composition at ${viewport.width}px: ${JSON.stringify(monitorComposition)}`);
  const controlPlane = page.getByText("Coverage Control Plane · ingestion", { exact: true });
  await controlPlane.waitFor({ state: "attached" });
  assert(await controlPlane.isVisible(), `QA control plane is not visibly leading at ${viewport.width}px: ${JSON.stringify(monitorComposition)}`);
  await page.getByText("Liquidity headroom narrowed after the latest reporting update", { exact: true }).waitFor();
  const slots = await page.locator('[data-testid="persona-workbench"] [data-slot]').evaluateAll((elements) => elements.map((element) => ({ slot: element.getAttribute("data-slot"), emphasized: element.getAttribute("data-emphasized") })));
  assert(JSON.stringify(slots.map((slot) => slot.slot)) === JSON.stringify(["inspector", "decision", "primary"]), `Unexpected QA slots: ${JSON.stringify(slots)}`);
  assert(slots[0]?.emphasized === "true", "QA inspector is not emphasized");
  const monitorAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/monitor-qa-populated-${viewport.width}x${viewport.height}.png`, fullPage: false });
  results.push({ route: "/monitor", viewport, state: "QA governance/control plane leads; populated live alert retained", httpFailures: httpFailures.slice(failureStart), ...monitorAudit });
  }

  if (requestedSurfaces.has("settings")) {
  failureStart = httpFailures.length;
  await page.goto(`${base}/settings?tab=models`, { waitUntil: "domcontentloaded" });
  const preferences = page.getByRole("tab", { name: "Preferences" });
  await preferences.waitFor();
  assert(await preferences.getAttribute("aria-selected") === "true", "Legacy models alias did not resolve to Preferences");
  await tabTo(page, preferences, "Preferences tab");
  await page.keyboard.press("End");
  const administration = page.getByRole("tab", { name: "Workspace administration" });
  await page.waitForFunction(() => document.querySelector('#settings-tab-workspace-administration')?.getAttribute('aria-selected') === 'true');
  assert(await administration.getAttribute("aria-selected") === "true", "Settings End key did not select Workspace administration");
  const diagnostics = page.getByText("Deployment diagnostics", { exact: true });
  await diagnostics.waitFor();
  assert(await diagnostics.locator("xpath=..").getAttribute("open") === null, "Deployment diagnostics is not collapsed by default");
  await tabTo(page, diagnostics, "Deployment diagnostics");
  await page.keyboard.press("Enter");
  await page.getByText("ANTHROPIC_MODEL", { exact: true }).waitFor();
  const settingsAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/settings-legacy-alias-diagnostics-${viewport.width}x${viewport.height}.png`, fullPage: false });
  results.push({ route: "/settings?tab=models", viewport, state: "legacy alias resolved; workspace tab and diagnostics opened by keyboard", httpFailures: httpFailures.slice(failureStart), ...settingsAudit });
  }
}

await page.emulateMedia({ reducedMotion: "reduce" });
await page.setViewportSize({ width: 1024, height: 768 });
if (requestedSurfaces.has("pipeline")) {
  const failureStart = httpFailures.length;
  await page.goto(`${base}/pipeline?mode=reference`, { waitUntil: "domcontentloaded" });
  await page.getByRole("table", { name: "Ordered pipeline stages and modules" }).waitFor();
  assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "Pipeline reduced-motion media state was not active");
  const reducedAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/pipeline-populated-reduced-motion-1024x768.png`, fullPage: false });
  reducedMotionResults.push({ route: "/pipeline?mode=reference", viewport: { width: 1024, height: 768 }, state: "populated ordered pipeline; reduced motion active", httpFailures: httpFailures.slice(failureStart), ...reducedAudit });
}
if (requestedSurfaces.has("monitor")) {
  const failureStart = httpFailures.length;
  await page.goto(`${base}/monitor`, { waitUntil: "domcontentloaded" });
  await page.getByText("Coverage Control Plane · ingestion", { exact: true }).waitFor();
  await page.getByText("Liquidity headroom narrowed after the latest reporting update", { exact: true }).waitFor();
  assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "Monitor reduced-motion media state was not active");
  const reducedAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/monitor-qa-populated-reduced-motion-1024x768.png`, fullPage: false });
  reducedMotionResults.push({ route: "/monitor", viewport: { width: 1024, height: 768 }, state: "populated QA governance; reduced motion active", httpFailures: httpFailures.slice(failureStart), ...reducedAudit });
}
if (requestedSurfaces.has("settings")) {
  const failureStart = httpFailures.length;
  await page.goto(`${base}/settings?tab=models`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Preferences" }).waitFor();
  assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "Settings reduced-motion media state was not active");
  const reducedAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/settings-populated-reduced-motion-1024x768.png`, fullPage: false });
  reducedMotionResults.push({ route: "/settings?tab=models", viewport: { width: 1024, height: 768 }, state: "legacy alias populated Preferences; reduced motion active", httpFailures: httpFailures.slice(failureStart), ...reducedAudit });
}

const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true });
const phonePage = await phoneContext.newPage();
phonePage.setDefaultTimeout(20_000);
phonePage.on("response", (response) => {
  if (response.status() >= 400) httpFailures.push({ status: response.status(), url: response.url() });
});
await installSurfaceStubs(phonePage, {
  id: "task4c-phone", email: "task4c-phone@local.dev", full_name: "Task 4C Phone Gate",
  role: "analyst", role_view: "analyst", is_active: true, source: "local",
});
const phoneFailureStart = httpFailures.length;
await phonePage.goto(`${base}/pipeline?mode=reference`, { waitUntil: "domcontentloaded" });
await phonePage.locator(".caos-enterprise-page").waitFor();
const phoneCoarse = await phonePage.evaluate(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  return {
    pointerCoarse: matchMedia("(pointer: coarse)").matches,
    phoneAskCount: Array.from(document.querySelectorAll(".caos-ask-phone-trigger")).filter(visible).length,
    compactAskCount: Array.from(document.querySelectorAll(".caos-ask-compact-utility")).filter(visible).length,
    labels: Array.from(document.querySelectorAll('button[aria-label^="Ask CAOS"]')).filter(visible).map((element) => element.getAttribute("aria-label")),
  };
});
assert(phoneCoarse.pointerCoarse, `Phone smoke did not expose a coarse pointer: ${JSON.stringify(phoneCoarse)}`);
assert(phoneCoarse.phoneAskCount === 1 && phoneCoarse.compactAskCount === 0, `Phone Ask variants drifted: ${JSON.stringify(phoneCoarse)}`);
assert(JSON.stringify(phoneCoarse.labels) === JSON.stringify(["Ask CAOS phone utility"]), `Phone Ask accessibility drifted: ${JSON.stringify(phoneCoarse)}`);
await phonePage.screenshot({ path: `${evidenceDir}/pipeline-coarse-phone-390x844.png`, fullPage: false });
phoneCoarse.httpFailures = httpFailures.slice(phoneFailureStart);
await phoneContext.close();

const evidence = { generatedAt: new Date().toISOString(), base, fixtureIdentity, httpFailures, results, reducedMotionResults, phoneCoarse };
await writeFile(evidenceJson, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
assert(httpFailures.length === 0, `Task 4C workflow HTTP failures: ${JSON.stringify(httpFailures)}`);
await browser.close();
