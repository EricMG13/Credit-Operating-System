/**
 * Playwright E2E: Pipeline route planning, graph inspection, lineage, and
 * narrow-workbench contracts. The reference demo is deterministic and does
 * not mutate persisted run state.
 */

import { expect, test, type Page } from "@playwright/test";

const REFERENCE_ISSUER = "a71f0000-0000-0000-0000-000000000001";

async function openReferenceDemo(page: Page) {
  await page.goto(`/pipeline/?issuer=${REFERENCE_ISSUER}&mode=reference`);
  await expect(page.getByRole("heading", { name: "Dependency map" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Seeded CP-5B reference — select a node to trace its drivers.")).toBeVisible({ timeout: 15000 });
}

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

test.describe("Pipeline", () => {
  test("pipeline-09 pipeline-10 pipeline-11 pipeline-12 pipeline-13 pipeline-14 pipeline-15 pipeline-16 pipeline-17 pipeline-18 pipeline-43 operates the reference workbench and simulation controls", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openReferenceDemo(page);

    await expect(page.getByText("Atlas Forge — reference route plan · 2L TL '31 new-issue review")).toBeVisible();
    await expect(page.getByRole("region", { name: "Execution graph; scroll horizontally to inspect all module layers" })).toBeVisible();
    await expect(page.getByRole("log", { name: "Execution trace log" })).toBeVisible();
    await page.getByRole("button", { name: "Open Run display controls" }).click();
    const controls = page.getByRole("dialog", { name: "Run display controls" });
    await expect(controls.getByRole("button", { name: "Play simulation" })).toBeVisible();
    await controls.getByRole("button", { name: "Play simulation" }).click();
    await expect(controls.getByRole("button", { name: "Pause simulation" })).toBeVisible();
    await controls.getByRole("button", { name: "Pause simulation" }).click();
    await expect(controls.getByRole("button", { name: "Play simulation" })).toBeVisible();

    await controls.getByRole("button", { name: "Covenant & docs deep-dive" }).click();
    await expect(page.getByText("Atlas Forge — reference route plan · Covenant & docs deep-dive")).toBeVisible();
    await expect(controls.getByRole("button", { name: "Play simulation" })).toBeVisible();
    await controls.getByRole("button", { name: "Speed 4x" }).click();
    await expect(controls.getByRole("button", { name: "Speed 4x" })).toHaveAttribute("aria-pressed", "true");
    await controls.getByRole("button", { name: "Play simulation" }).click();
    await expect(controls.getByRole("button", { name: "Pause simulation" })).toBeVisible();
    await controls.getByRole("button", { name: "Pause simulation" }).click();
    await expect(controls.getByRole("button", { name: "Play simulation" })).toBeVisible();
    await controls.getByRole("button", { name: "Reset run" }).click();

    await controls.getByRole("button", { name: "Stage lanes" }).click();
    await expect(page.getByRole("heading", { name: "Stage lanes" })).toBeVisible();
    await controls.getByRole("button", { name: "Dependency map" }).click();
    await controls.getByTitle("Dim completed nodes").click();
    await expect(controls.getByTitle("Dim completed nodes")).toHaveClass(/bg-caos-elevated/);
  });

  test("pipeline-19 pipeline-20 pipeline-21 pipeline-22 pipeline-23 pipeline-24 pipeline-25 pipeline-26 pipeline-27 pipeline-28 pipeline-29 selects graph lineage and renders the module inspector", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openReferenceDemo(page);

    const graph = page.getByRole("region", { name: "Execution graph; scroll horizontally to inspect all module layers" });
    const cp1 = graph.getByTitle(/Financial Spreading — Enter to select/);
    await cp1.click();
    await expect(cp1).toHaveAttribute("aria-pressed", "true");
    const inspector = page.getByRole("complementary", { name: "Run module inspection and lineage" });
    await expect(inspector.getByRole("heading", { name: "Financial Spreading" })).toBeVisible();
    await expect(inspector.getByTitle(/Open CP-1 outputs/)).toBeVisible();
    await expect(inspector.getByText("CP-X", { exact: true }).first()).toBeVisible();

    const cp1c = graph.getByTitle(/Peer Benchmarking — Enter to select/);
    await cp1c.click();
    await expect(cp1c).toHaveAttribute("aria-pressed", "true");
    await expect(inspector.getByText("QA-117", { exact: true })).toBeVisible();
    await expect(inspector.getByText(/Citation E-44 unresolved/)).toBeVisible();
  });

  test("pipeline-30 pipeline-31 pipeline-32 pipeline-33 pipeline-34 pipeline-35 pipeline-44 pipeline-45 traces drivers, opens evidence, and hands module output to Deep-Dive", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openReferenceDemo(page);

    const pipelineNav = page.getByRole("link", { name: "Pipeline" });
    await expect(pipelineNav).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: /EBITDA quality — add-backs/ }).click();
    await expect(page.getByTitle(/Financial Spreading — Enter to select/)).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Open source for E-44" }).click();
    const evidence = page.getByRole("dialog", { name: "Source evidence E-44" });
    await expect(evidence).toBeVisible();
    await expect(evidence.getByText("E-44", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(evidence).toBeHidden();

    await page.getByTitle(/Open CP-1 outputs/).click();
    await expect(page).toHaveURL(/\/deepdive\/\?.*issuer=/);
  });

  test("pipeline-09 pipeline-10 pipeline-11 pipeline-12 pipeline-13 pipeline-14 pipeline-15 pipeline-16 pipeline-17 pipeline-18 pipeline-19 pipeline-20 pipeline-21 pipeline-22 pipeline-23 pipeline-24 pipeline-25 pipeline-26 pipeline-27 pipeline-28 pipeline-29 pipeline-30 pipeline-31 pipeline-32 pipeline-33 pipeline-34 pipeline-35 pipeline-43 pipeline-44 pipeline-45 preserves the essential workbench at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReferenceDemo(page);

    await page.getByRole("button", { name: "Open Workflows" }).click();
    await expect(page.getByRole("dialog", { name: "Workflows" }).getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open Run display controls" }).click();
    const controls = page.getByRole("dialog", { name: "Run display controls" });
    await expect(controls.getByRole("button", { name: "Stage lanes" })).toHaveCount(1);
    await controls.getByRole("button", { name: "Stage lanes" }).click();
    await expect(page.getByRole("heading", { name: "Stage lanes" })).toBeVisible();
    await expect(controls.getByRole("button", { name: "Dependency map" })).toBeVisible();
    await expect(controls.getByText(/CLEARANCE:/).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
});
