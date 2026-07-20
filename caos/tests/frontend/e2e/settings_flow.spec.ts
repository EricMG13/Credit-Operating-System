/**
 * Playwright E2E: Settings (/settings).
 *
 * Two halves: browser-local Research defaults (localStorage) and a read-only
 * mirror of the server config from /api/settings. Runs against the
 * single-process server — see research_flow.spec.ts for setup.
 */

import { test, expect, type Page } from "@playwright/test";

// Fill the Audience default, save, and wait for the confirmation.
async function saveAudience(page: Page, value: string) {
  await page.getByRole("tab", { name: "Research" }).click();
  await page.getByLabel("Audience").fill(value);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // exact: the panel heading also contains "saved".
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

// Auth is handled once in global-setup (storageState); pages render signed-in.
test.describe("Settings", () => {
  test("mirrors the server workspace configuration", async ({ page }) => {
    await page.goto("/settings/");

    await expect(page.locator('span[title="Settings"]')).toBeVisible();
    const sections = page.getByRole("tablist", { name: "Settings sections" });
    await expect(sections).toBeVisible();
    await expect(sections.getByRole("tab")).toHaveCount(5);
    await page.getByRole("tab", { name: "Workspace" }).click();

    await expect(page.getByRole("heading", { name: "Workspace configuration", exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/\u00b7 runtime model /)).toBeVisible();
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
    await page.getByRole("tab", { name: "Research" }).click();
    await expect(page.getByLabel("Audience")).toHaveValue(value);
  });

  test("Save changes is inert until a field diverges from the loaded profile", async ({ page }) => {
    await page.goto("/settings/");
    const save = page.getByRole("button", { name: "Save changes" });
    // Pristine after load: aria-disabled with the no-changes reason.
    await expect(save).toHaveAttribute("aria-disabled", "true", { timeout: 10000 });
    await expect(save).toHaveAttribute("title", "No unsaved changes");

    // Diverge one field → the primary becomes actionable.
    await page.getByRole("tab", { name: "Research" }).click();
    await page.getByLabel("Audience").fill(`Dirty ${Date.now()}`);
    await expect(save).not.toHaveAttribute("aria-disabled", "true");
    await expect(save).not.toHaveAttribute("title", "No unsaved changes");

    // Saving returns to pristine.
    const saveResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/settings/analyst"
      && response.request().method() === "PATCH",
    );
    await save.click();
    const response = await saveResponse;
    expect(response.ok(), `settings save failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).toHaveAttribute("title", "No unsaved changes");
  });

  test("saved defaults seed a new Research brief", async ({ page }) => {
    await page.goto("/settings/");

    const value = `Seeded IC ${Date.now()}`;
    await saveAudience(page, value);

    // Same browser context → localStorage carries the standing lens to Research.
    const researchHydrated = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/settings/analyst" && response.ok(),
    );
    await page.goto("/research/");
    await researchHydrated;
    // Audience is seeded into state on load but lives inside the collapsed
    // "Advanced brief" disclosure — expand it before reading the field.
    const advanced = page.getByRole("button", { name: "Advanced brief" });
    await advanced.click();
    await expect(advanced).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("Audience")).toHaveValue(value);
  });

  test("keeps every Settings section reachable without page overflow at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings/");

    const sections = page.getByRole("tablist", { name: "Settings sections" });
    await expect(sections).toBeVisible();
    await expect(sections.getByRole("tab")).toHaveCount(5);

    const panels = [
      ["Models", "settings-panel-models"],
      ["Research", "settings-panel-research"],
      ["Email Intel", "settings-panel-email"],
      ["Portfolios", "settings-panel-portfolios"],
      ["Workspace", "settings-panel-workspace"],
    ] as const;
    for (const [label, panelId] of panels) {
      const tab = sections.getByRole("tab", { name: label });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(`#${panelId}[role="tabpanel"]`)).toBeVisible();
      const pageOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(pageOverflow).toBeLessThanOrEqual(1);
    }

    const workspace = sections.getByRole("tab", { name: "Workspace" });
    await workspace.focus();
    await workspace.press("Home");
    await expect(sections.getByRole("tab", { name: "Models" })).toHaveAttribute("aria-selected", "true");
  });
});
