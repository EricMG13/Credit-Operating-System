/**
 * Playwright E2E: Settings (/settings).
 *
 * Two halves: browser-local Research defaults (localStorage) and a read-only
 * mirror of the server config from /api/settings. Runs against the
 * single-process server — see research_flow.spec.ts for setup.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAnalyst } from "./_auth";

// Fill the Audience default, save, and wait for the confirmation.
async function saveAudience(page: Page, value: string) {
  await page.getByLabel("Audience").fill(value);
  await page.getByRole("button", { name: "Save" }).click();
  // exact: the panel heading also contains "saved".
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

test.describe("Settings", () => {
  // Pages gate on a signed-in profile; authenticate before navigating. Unique
  // name per worker so parallel workers don't race to create the same profile.
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAsAnalyst(page, `E2E W${testInfo.workerIndex}`);
  });

  test("mirrors the server workspace configuration", async ({ page }) => {
    await page.goto("/settings/");

    await expect(page.getByRole("heading", { name: /Research defaults/ })).toBeVisible({
      timeout: 10000,
    });
    // These rows only render once /api/settings resolves (not the loading/error state).
    await expect(page.getByText("Governance & QA")).toBeVisible();
    await expect(page.getByText("Council seats")).toBeVisible();
    await expect(page.getByText("Deep Research")).toBeVisible();
  });

  test("research defaults persist to localStorage across reloads", async ({ page }) => {
    await page.goto("/settings/");

    const value = `Test IC ${Date.now()}`;
    await saveAudience(page, value);

    await page.reload();
    await expect(page.getByLabel("Audience")).toHaveValue(value);
  });

  test("saved defaults seed a new Research brief", async ({ page }) => {
    await page.goto("/settings/");

    const value = `Seeded IC ${Date.now()}`;
    await saveAudience(page, value);

    // Same browser context → localStorage carries the standing lens to Research.
    await page.goto("/research/");
    await expect(page.getByLabel("Audience")).toHaveValue(value);
  });
});
