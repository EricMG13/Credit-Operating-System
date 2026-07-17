/**
 * Playwright E2E: Monitor worklist, email intake, and replay controls.
 *
 * Feature references in the test names are consumed by the canonical quality
 * tracker, so each passing node maps to the exact implemented workflow.
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test.describe("Monitor", () => {
  test("monitor-01 monitor-03 email intake exposes fixed severity totals and filters the sample", async ({ page }) => {
    await page.goto("/monitor/");
    await expect(page.getByRole("tab", { name: "Email intake" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("tab", { name: "Email intake" }).click();

    const critical = page.getByRole("button", { name: /^Critical: 3 messages/ });
    await expect(critical).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /^High: 11 messages/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Medium: 27 messages/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Low: 64 messages/ })).toBeVisible();
    await expect(page.getByText("Showing 8 of 105 today · sample")).toBeVisible();

    await critical.click();
    await expect(critical).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Showing 2 of 3 critical · sample")).toBeVisible();
    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(critical).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Showing 8 of 105 today · sample")).toBeVisible();
  });

  test("monitor-02 email detail opens with classification metadata and closes with Escape", async ({ page }) => {
    const monitorHydrated = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/settings/analyst" && response.ok(),
    );
    await page.goto("/monitor/?dataset=email");
    await monitorHydrated;
    const firstEmail = page.getByRole("button", { name: /^Open email:/ }).first();
    await expect(firstEmail).toBeVisible({ timeout: 15000 });
    await firstEmail.click();

    const dialog = page.getByRole("dialog", { name: /^Email:/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("CP-MON classification")).toBeVisible();
    await expect(dialog.getByText(/routed →/)).toBeVisible();
    await expect(dialog.getByText("From", { exact: true })).toBeVisible();
    await expect(dialog.getByText("To", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Time", { exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("monitor-04 monitor-07 alert replay and header KPIs render with labelled severity and routing", async ({ page }) => {
    await page.goto("/monitor/");
    await expect(page.getByText("Monitor — email intelligence & alert routing")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Replay criticals", { exact: true })).toBeVisible();
    await expect(page.getByText("Replay today", { exact: true })).toBeVisible();

    const replay = page.getByRole("list", { name: "Seeded demo alert replay (read-only)" });
    await expect(replay).toBeVisible({ timeout: 15000 });
    await expect(replay.getByText("Read-only replay — rows cannot be acknowledged.")).toBeVisible();
    await expect(replay.getByText(/route → CP-/).first()).toBeVisible();
    await expect(replay.getByText(/^(critical|high|medium|low)$/).first()).toBeVisible();
  });

  test("monitor-05 monitor-06 playback controls switch PAUSED and SIM states and apply speed", async ({ page }) => {
    await page.goto("/monitor/");
    await page.getByRole("button", { name: "Open Replay controls" }).click();
    const controls = page.getByRole("dialog", { name: "Replay controls" });
    await expect(controls).toBeVisible();

    const pause = controls.getByRole("button", { name: "Pause simulation" });
    await expect(pause).toBeVisible({ timeout: 15000 });
    await pause.click();
    await expect(controls.getByText(/^PAUSED · \d{2}:\d{2}:\d{2} ET$/)).toBeVisible();
    await expect(controls.getByRole("button", { name: "Play simulation" })).toBeVisible();

    const speed = controls.getByRole("button", { name: "Speed 4x" });
    await speed.click();
    await expect(speed).toHaveAttribute("aria-pressed", "true");
    await controls.getByRole("button", { name: "Play simulation" }).click();
    await expect(controls.getByText(/^SIM · \d{2}:\d{2}:\d{2} ET$/)).toBeVisible();
  });
});
