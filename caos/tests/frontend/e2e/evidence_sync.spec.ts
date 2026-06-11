/**
 * Playwright E2E: Evidence Sync — cross-pane selection (Blueprint §4, §7.1).
 *
 * Verifies the core interaction: clicking a data point (inline citation badge,
 * Evidence Trace card, or covenant gauge) drives a single shared selection that
 *  (a) filters the Evidence Trace panel, and
 *  (b) scrolls + highlights the exact source clause in the Source Vault.
 *
 * Runs against the seeded demo issuer (Acme) served by the mock backend or the
 * real API. Requires the dev server (:3000) and an API (:8000).
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
// Seeded demo issuer with a completed run + narrative + conclusions.
const ISSUER_ID = process.env.PLAYWRIGHT_ISSUER_ID || "11111111-1111-1111-1111-111111111111";

test.describe("Evidence Sync", () => {
  test.beforeEach(async ({ page }) => {
    // Seed an auth token so the app treats us as signed in, then open the cockpit.
    await page.addInitScript(() => localStorage.setItem("caos_token", "e2e-token"));
    await page.goto(`${BASE_URL}/issuers/${ISSUER_ID}`);
    await expect(page.getByText("Source Vault")).toBeVisible({ timeout: 15000 });
    // Analysis tab is the default; wait for narrative + citation badges to render.
    await expect(page.getByTestId("citation-badge").first()).toBeVisible({ timeout: 15000 });
  });

  test("clicking an inline citation badge highlights the source clause and filters the trace", async ({
    page,
  }) => {
    const badge = page.getByTestId("citation-badge").first();
    const conclusionId = await badge.getAttribute("data-conclusion-id");
    expect(conclusionId).toBeTruthy();

    // No clause highlighted before interaction.
    await expect(page.locator("[data-highlighted='true']")).toHaveCount(0);

    await badge.click();

    // (a) Source Vault highlights exactly one clause (the cited source).
    await expect(page.locator("[data-highlighted='true']")).toHaveCount(1);

    // (b) Evidence Trace filters to the selected conclusion's lineage.
    await expect(page.getByText("filtered to selection")).toBeVisible();
    await expect(
      page.locator(`[data-testid='trace-card'][data-conclusion-id='${conclusionId}']`).first()
    ).toBeVisible();
  });

  test("the three-tier lineage (Evidence → Risk Mechanic → Credit Implication) is shown", async ({
    page,
  }) => {
    await page.getByTestId("citation-badge").first().click();
    const card = page.getByTestId("trace-card").first();
    await expect(card.getByText("Evidence")).toBeVisible();
    await expect(card.getByText("Risk Mechanic")).toBeVisible();
    await expect(card.getByText("Credit Implication")).toBeVisible();
  });

  test("a different selection source highlights a different clause", async ({ page }) => {
    // Citation badge → clause A
    await page.getByTestId("citation-badge").first().click();
    const clauseA = await page.locator("[data-highlighted='true']").getAttribute("data-clause-id");

    // Covenant gauge (Capex Limit) → clause B, via the shared selection store
    await page.getByText("Capex Limit ($M)").first().click();
    await expect(page.locator("[data-highlighted='true']")).toHaveCount(1);
    const clauseB = await page.locator("[data-highlighted='true']").getAttribute("data-clause-id");

    expect(clauseB).toBeTruthy();
    expect(clauseB).not.toEqual(clauseA);
  });

  test("clicking the focused selection again clears it (toggle)", async ({ page }) => {
    const badge = page.getByTestId("citation-badge").first();
    await badge.click();
    await expect(page.getByText("filtered to selection")).toBeVisible();
    await badge.click();
    await expect(page.getByText("filtered to selection")).toHaveCount(0);
    await expect(page.locator("[data-highlighted='true']")).toHaveCount(0);
  });
});
