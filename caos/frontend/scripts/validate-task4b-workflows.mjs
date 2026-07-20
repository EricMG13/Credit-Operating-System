import { chromium } from "playwright";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const base = process.env.BASE || "http://127.0.0.1:4176";
const evidenceDir = process.env.EVIDENCE_DIR || "/private/tmp/caos-task4b-workflows";
const evidenceJson = process.env.EVIDENCE_JSON || `${evidenceDir}/evidence.json`;
const reducedMotion = process.env.REDUCED_MOTION === "1";
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function tabTo(page, locator, label, limit = 140) {
  await locator.waitFor({ state: "visible" });
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard focus did not reach ${label} within ${limit} Tab presses`);
}

async function audit(page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
      },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 12).map((node) => ({ target: node.target, html: node.html })),
    }));
  });
  const layout = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const hasScrollOwner = (element) => {
      for (let owner = element.parentElement; owner && owner !== document.body; owner = owner.parentElement) {
        const style = getComputedStyle(owner);
        if (/(auto|scroll)/.test(style.overflowX) && owner.scrollWidth > owner.clientWidth + 1) return true;
      }
      return false;
    };
    const controls = Array.from(document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])"))
      .filter(visible)
      .filter((element) => !element.matches(":disabled,[aria-disabled='true']"));
    const clippedControls = controls.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if ((rect.left >= -1 && rect.right <= innerWidth + 1) || hasScrollOwner(element)) return [];
      return [{
        label: (element.getAttribute("aria-label") || element.textContent || element.tagName).trim().replace(/\s+/g, " ").slice(0, 100),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }];
    });
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clippedControls,
    };
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
page.setDefaultTimeout(15_000);
if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
const httpFailures = [];
page.on("response", (response) => {
  if (response.status() >= 400) httpFailures.push({ status: response.status(), url: response.url() });
});
await installSurfaceStubs(page, {
  id: "task4b-workflow",
  email: "task4b-workflow@local.dev",
  full_name: "Task 4B Workflow Gate",
  role: "analyst",
  is_active: true,
  source: "local",
});

const results = [];
for (const viewport of viewports) {
  await page.setViewportSize(viewport);

  await page.goto(`${base}/deepdive?mode=reference`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1, name: "Deep-Dive" }).waitFor();
  await page.keyboard.press("Meta+m");
  const finder = page.getByRole("combobox", { name: "Find a module" });
  await finder.waitFor();
  await page.keyboard.type("CP-4C");
  await page.keyboard.press("Enter");
  const analysis = page.getByTitle("Current group: Analysis");
  const capacity = page.getByRole("button", { name: "Covenant Capacity", exact: true });
  await analysis.waitFor();
  assert(await analysis.getAttribute("aria-expanded") === "true", "Analysis group is not expanded after finder selection");
  assert(await capacity.getAttribute("aria-current") === "true", "CP-4C is not current inside Analysis");
  assert(await page.getByTitle("Open group: Foundation").getAttribute("aria-expanded") === "false", "Foundation also expanded");
  assert(await page.getByTitle("Open group: Governance & Debate").getAttribute("aria-expanded") === "false", "Governance group also expanded");
  const deepDiveAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/deepdive-reference-cp4c-${viewport.width}x${viewport.height}.png`, fullPage: false });
  results.push({ route: "/deepdive?mode=reference", viewport, state: "finder selected CP-4C; Analysis solely expanded", ...deepDiveAudit });

  await page.goto(`${base}/decisions`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1, name: "IC Book" }).waitFor();
  const addAgenda = page.getByRole("button", { name: "Add agenda item" });
  await tabTo(page, addAgenda, "Add agenda item");
  await page.keyboard.press("Enter");
  const agendaSteps = page.getByRole("list", { name: "Agenda item steps" });
  const references = page.locator('section[aria-label="References"]');
  await agendaSteps.waitFor();
  await references.waitFor();
  assert((await agendaSteps.locator('[aria-current="step"]').textContent())?.trim() === "1. References", "References is not the current step");
  assert(!(await page.getByText("Request failed with status code 404", { exact: true }).isVisible().catch(() => false)), `IC workflow still shows a 404 banner: ${JSON.stringify(httpFailures)}`);
  const icAudit = await audit(page);
  await page.screenshot({ path: `${evidenceDir}/ic-book-references-open-${viewport.width}x${viewport.height}.png`, fullPage: false });
  results.push({ route: "/decisions", viewport, state: "Add agenda item opened; References current", ...icAudit });
}

const evidence = { generatedAt: new Date().toISOString(), base, reducedMotion, httpFailures, results };
await writeFile(evidenceJson, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
assert(httpFailures.length === 0, `Task 4B workflow HTTP failures: ${JSON.stringify(httpFailures)}`);
await browser.close();
