import { chromium } from "playwright";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const base = process.env.BASE || "http://127.0.0.1:4176";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function tabTo(page, locator, label, limit = 120) {
  await locator.waitFor({ state: "visible" });
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard focus did not reach ${label} within ${limit} Tab presses`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15_000);
await installSurfaceStubs(page, {
  id: "task4b-keyboard",
  email: "task4b-keyboard@local.dev",
  full_name: "Task 4B Keyboard Gate",
  role: "analyst",
  is_active: true,
  source: "local",
});

const results = [];

await page.goto(`${base}/deepdive?mode=reference`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "Deep-Dive" }).waitFor();
const analysisGroup = page.getByRole("button", { name: /Analysis/ }).first();
await tabTo(page, analysisGroup, "Deep-Dive Analysis group");
await page.keyboard.press("Enter");
assert(await analysisGroup.getAttribute("aria-expanded") === "true", "Deep-Dive Analysis group did not open from the keyboard");
results.push({ route: "/deepdive", action: "opened Analysis group" });

await page.goto(`${base}/model`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "Model Builder" }).waitFor();
const assumptions = page.getByRole("button", { name: "Assumptions", exact: true });
await tabTo(page, assumptions, "Model assumptions support control");
await page.keyboard.press("Enter");
assert(await assumptions.getAttribute("aria-pressed") === "true", "Model assumptions support panel did not open from the keyboard");
results.push({ route: "/model", action: "opened Assumptions support panel" });

await page.goto(`${base}/decisions`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "IC Book" }).waitFor();
const addAgenda = page.getByRole("button", { name: "Add agenda item" });
await tabTo(page, addAgenda, "IC Book Add agenda item");
await page.keyboard.press("Enter");
const agendaSteps = page.getByRole("list", { name: "Agenda item steps" });
await agendaSteps.waitFor();
assert(await agendaSteps.isVisible(), "IC Book staged agenda form did not open from the keyboard");
results.push({ route: "/decisions", action: "opened staged agenda form" });

await page.goto(`${base}/reports`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "Report Studio" }).waitFor();
const reportUtilities = page.getByRole("button", { name: "Open Report utilities" });
await tabTo(page, reportUtilities, "Report utilities");
await page.keyboard.press("Enter");
const zoomSlider = page.getByRole("slider", { name: "Document zoom" });
await tabTo(page, zoomSlider, "Report document zoom");
await page.keyboard.press("Home");
await page.keyboard.press("ArrowRight");
assert(await zoomSlider.getAttribute("aria-valuetext") === "105 percent", "Report zoom slider did not announce its keyboard change");
const fit = page.getByRole("button", { name: "Fit", exact: true });
await tabTo(page, fit, "Report Fit control");
await page.keyboard.press("Enter");
assert(await zoomSlider.getAttribute("aria-valuetext") === "100 percent", "Report Fit did not restore the proofing floor from the keyboard");
results.push({ route: "/reports", action: "changed and fit document zoom" });

console.log(JSON.stringify({ base, results }, null, 2));
await browser.close();
