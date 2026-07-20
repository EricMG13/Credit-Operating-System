import assert from "node:assert/strict";
import { chromium } from "playwright";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const markerText = "REFERENCE · seeded, not issuer data";

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installSurfaceStubs(context, {
    id: "data-mode-local",
    email: "data-mode@local.dev",
    full_name: "Data Mode Bot",
    role: "analyst",
    is_active: true,
    source: "local",
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/research`, { waitUntil: "networkidle" });
  const rail = page.getByRole("complementary", { name: "Workspace navigation" });
  const modelLink = rail.getByRole("link", { name: "Model Builder" });
  assert.equal(new URL(await modelLink.getAttribute("href"), baseUrl).searchParams.has("mode"), false);

  await page.getByRole("link", { name: "Open reference example" }).click();
  await page.waitForURL((url) => url.searchParams.get("mode") === "reference");
  await page.getByText(markerText, { exact: true }).waitFor();
  assert.equal(new URL(await modelLink.getAttribute("href"), baseUrl).searchParams.get("mode"), "reference");

  await page.getByRole("link", { name: "Return to live research" }).click();
  await page.waitForURL((url) => !url.searchParams.has("mode"));
  await page.getByText(markerText, { exact: true }).waitFor({ state: "detached" });
  assert.equal(new URL(await modelLink.getAttribute("href"), baseUrl).searchParams.has("mode"), false);

  await page.goto(`${baseUrl}/research?mode=reference`, { waitUntil: "networkidle" });
  await page.getByText(markerText, { exact: true }).waitFor();
  assert.equal(new URL(await modelLink.getAttribute("href"), baseUrl).searchParams.get("mode"), "reference");

  await page.goto(`${baseUrl}/research`, { waitUntil: "networkidle" });
  await page.getByText(markerText, { exact: true }).waitFor({ state: "detached" });
  assert.equal(new URL(await modelLink.getAttribute("href"), baseUrl).searchParams.has("mode"), false);

  await page.goto(`${baseUrl}/pipeline`, { waitUntil: "domcontentloaded" });
  await page.locator(".pipeline-workbench").waitFor();
  await page.getByText(markerText, { exact: true }).waitFor({ state: "detached" });
  assert.equal(await page.getByText(/persisted CP-X run/i).count(), 1);
  assert.equal(await page.getByText("REFERENCE PLAN", { exact: true }).count(), 0);

  await page.goto(`${baseUrl}/pipeline?mode=reference`, { waitUntil: "domcontentloaded" });
  await page.locator(".pipeline-workbench").waitFor();
  await page.getByText(markerText, { exact: true }).waitFor();
  assert.equal(await page.getByText("REFERENCE PLAN", { exact: true }).count(), 1);
  assert.equal(await page.getByText(/24 planned · 0 executed/).count(), 1);

  await page.goto(`${baseUrl}/monitor`, { waitUntil: "domcontentloaded" });
  await page.locator(".monitor-workbench").waitFor();
  await page.getByText(markerText, { exact: true }).waitFor({ state: "detached" });
  await page.getByText("Monitor — live alert worklist", { exact: true }).waitFor();
  assert.equal(await page.getByRole("tab", { name: "Alerts" }).count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Governance" }).count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Replay" }).count(), 0);
  assert.equal(await page.getByRole("tab", { name: "Email intake" }).count(), 0);

  await page.goto(`${baseUrl}/monitor?mode=reference`, { waitUntil: "domcontentloaded" });
  await page.locator(".monitor-workbench").waitFor();
  await page.getByText(markerText, { exact: true }).waitFor();
  await page.getByText("Monitor — Reference replay & email examples", { exact: true }).waitFor();
  assert.equal(await page.getByRole("tab", { name: "Replay" }).count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Email intake" }).count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Governance" }).count(), 0);

  const pipelineLink = page.getByRole("complementary", { name: "Workspace navigation" }).getByRole("link", { name: "Pipeline" });
  await pipelineLink.click();
  await page.waitForURL((url) => url.pathname === "/pipeline" && url.searchParams.get("mode") === "reference");
  await page.locator(".pipeline-workbench").waitFor();
  await page.getByText(markerText, { exact: true }).waitFor();

  await context.close();
  process.stdout.write("data-mode round-trip: PASS\n");
} finally {
  await browser.close();
}
