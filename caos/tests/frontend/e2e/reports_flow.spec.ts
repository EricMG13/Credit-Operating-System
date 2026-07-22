/**
 * Playwright E2E: Report Studio committee-deliverable workflow.
 *
 * The reference issuer is deliberately used here: it exposes the six authored
 * deliverables and permits editorial composition without requiring a live run.
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test.describe("Report Studio", () => {
  test("reports-01 reports-02 reports-12 reports-13 reports-14 reports-25 lists and selects committee deliverables", async ({ page }) => {
    const draftReady = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET"
        && url.pathname.startsWith("/api/reports/drafts/");
    });
    await page.goto("/reports/?mode=reference");
    await expect(page.getByText("Committee Deliverables", { exact: true })).toBeVisible({ timeout: 15000 });
    await draftReady;

    const titles = [
      "Credit Snapshot",
      "Earnings Update — Q1-26",
      "IC Credit Memo",
      "Covenant & Capacity Brief",
      "Monitoring Exceptions — Reference",
      "Model Appendix",
    ];
    for (const title of titles) {
      await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /Credit Snapshot/ })).toHaveAttribute("aria-current", "true");

    const memo = page.getByRole("button", { name: /IC Credit Memo/ });
    await memo.click();
    await expect(memo).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("CONDITIONAL — QA-117", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/IC Credit Memo is held by CP-5/)).toBeVisible();
    await expect(page.getByText("Report Studio · CP-RENDER", { exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ sections · \d+ citations/).first()).toBeVisible();
  });

  test("reports-03 reports-04 reports-05 reports-20 reports-24 persist display and server draft preferences", async ({ page }) => {
    const draftResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET"
        && url.pathname.startsWith("/api/reports/drafts/");
    });
    await page.goto("/reports/?mode=reference");
    await expect(page.getByLabel("Report preview")).toBeVisible({ timeout: 15000 });
    const loadedDraft = await (await draftResponse).json() as {
      payload?: { show_sources?: boolean };
    } | null;
    await page.getByRole("button", { name: "Open Report utilities" }).click();
    let utilities = page.getByRole("dialog", { name: "Report utilities" });

    await utilities.getByRole("button", { name: "FIT" }).click();
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("caos-e-zoom")))).toBeGreaterThanOrEqual(0.4);

    const zoom100 = utilities.getByRole("button", { name: "100%", exact: true });
    await zoom100.click();
    await expect(zoom100).toHaveAttribute("aria-pressed", "true");
    const white = utilities.getByRole("button", { name: "Paper tone White" });
    await white.click();
    await expect(white).toHaveAttribute("aria-pressed", "true");
    const sources = utilities.getByRole("button", { name: "SOURCES" });
    const loadedSources = loadedDraft?.payload?.show_sources ?? true;
    await expect(sources).toHaveAttribute("aria-pressed", String(loadedSources));
    // This workspace is durable across test runs. Normalize an existing OFF
    // preference through the UI before asserting the ON → OFF mutation.
    if (!loadedSources) {
      await sources.click();
      await expect(sources).toHaveAttribute("aria-pressed", "true");
    }
    await sources.click();
    await expect(sources).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText(/SOURCES OFF · ZOOM 100%/)).toBeVisible();
    await expect(page.getByText("Draft autosaved", { exact: true })).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByLabel("Report preview")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Open Report utilities" }).click();
    utilities = page.getByRole("dialog", { name: "Report utilities" });
    await expect(utilities.getByRole("button", { name: "100%", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(utilities.getByRole("button", { name: "Paper tone White" })).toHaveAttribute("aria-pressed", "true");
    await expect(utilities.getByRole("button", { name: "SOURCES" })).toHaveAttribute("aria-pressed", "false");
  });

  test("reports-06 reports-07 reports-08 reports-22 reports-23 edits and composes report sections", async ({ page }) => {
    await page.goto("/reports/?mode=reference");
    await expect(page.getByLabel("Report preview")).toBeVisible({ timeout: 15000 });

    // Edit stays disabled until the server draft settles (canEditComposition);
    // a cold CI runner can take seconds, so wait for enabled, never for luck.
    const editButton = page.getByRole("button", { name: "Edit report", exact: true });
    await expect(editButton).toBeEnabled({ timeout: 15000 });
    await editButton.click();
    await expect(page.getByText(/EDITING · SOURCES/)).toBeVisible();
    const editable = page.getByRole("textbox", { name: /^Edit report field/ }).first();
    await expect(editable).toBeVisible();
    await editable.fill("E2E committee wording");
    await editable.blur();
    await expect(page.getByRole("button", { name: "Revert override" })).toBeVisible();

    const composeToggle = page.locator(".report-studio-panels button[aria-pressed]").first();
    await expect(composeToggle).toBeVisible();
    await composeToggle.click();
    await expect(composeToggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText(/\d+ of \d+ included/)).toBeVisible();

    await page.getByRole("button", { name: "Open Report utilities" }).click();
    const utilities = page.getByRole("dialog", { name: "Report utilities" });
    await expect(utilities.getByRole("button", { name: "RESET 1 EDIT" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await utilities.getByRole("button", { name: "RESET 1 EDIT" }).click();
    await expect(page.getByRole("button", { name: "Revert override" })).toBeHidden();
  });

  test("reports-09 reports-10 lineage evidence opens the source viewer and Escape closes it", async ({ page }) => {
    await page.goto("/reports/?mode=reference");
    await expect(page.getByText("Lineage — built from", { exact: true })).toBeVisible({ timeout: 15000 });
    const evidence = page.getByRole("button", { name: /^Open source E-/ }).first();
    await expect(evidence).toBeVisible();
    await evidence.click();

    const dialog = page.getByRole("dialog", { name: /^Source evidence E-/ });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(
      (element) => element.contains(document.activeElement),
    )).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
