/**
 * Playwright E2E: Monitor worklist, email intake, and replay controls.
 *
 * Feature references in the test names are consumed by the canonical quality
 * tracker, so each passing node maps to the exact implemented workflow.
 */

import { test, expect } from "./fixtures";

interface CreatedWatchRule {
  id: string;
  current_version: number;
}

interface ManualEvaluation {
  evaluation_id: string;
  outcome: "matched" | "ignored" | "rejected";
  alert_event_id: string | null;
  created: boolean;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test.describe("Monitor", () => {
  test("monitor-01 monitor-03 email intake exposes fixed severity totals and filters the sample", async ({ page }) => {
    await page.goto("/monitor/?mode=reference");
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
    await page.goto("/monitor/?mode=reference&dataset=email");
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
    await page.goto("/monitor/?mode=reference");
    await expect(page.getByText("Monitor — Reference replay & email examples")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Replay criticals", { exact: true })).toBeVisible();
    await expect(page.getByText("Replay today", { exact: true })).toBeVisible();

    const replay = page.getByRole("list", { name: "Seeded demo alert replay (read-only)" });
    await expect(replay).toBeVisible({ timeout: 15000 });
    await expect(replay.getByText("Read-only replay — rows cannot be acknowledged.")).toBeVisible();
    await expect(replay.getByText(/route → CP-/).first()).toBeVisible();
    await expect(replay.getByText(/^(critical|high|medium|low)$/).first()).toBeVisible();
  });

  test("monitor-05 monitor-06 playback controls switch PAUSED and SIM states and apply speed", async ({ page }) => {
    await page.goto("/monitor/?mode=reference");
    const controls = page.getByRole("toolbar", { name: "Simulation Controls" });
    await expect(controls).toBeVisible();

    // The shared Reference clock may still be running after another workflow
    // test. Normalize it before asserting the play/pause transition.
    await controls.getByRole("button", { name: "Reset run" }).click();
    const pause = controls.getByRole("button", { name: "Pause simulation" });
    await expect(pause).toBeVisible({ timeout: 15000 });
    await pause.click();
    await expect(page.getByText(/^PAUSED · seeded Reference replay/)).toBeVisible();
    const play = controls.getByRole("button", { name: "Play simulation" });
    await expect(play).toBeVisible();

    const speed = controls.getByRole("button", { name: "Speed 4x" });
    await speed.click();
    await expect(speed).toHaveAttribute("aria-pressed", "true");
    await play.click();
    await expect(page.getByText(/^SIM · seeded Reference replay/)).toBeVisible();
  });

  test("C3 real API creates, deduplicates, retries, and persists an acknowledged alert", async ({ page, request }, testInfo) => {
    const marker = testInfo.project.name;
    const ruleName = `C3 activation E2E ${marker}`;
    const alertTitle = `C3 persisted alert ${marker}`;
    let createdRule: CreatedWatchRule | null = null;

    await page.goto("/monitor/");
    await expect(page.getByRole("button", { name: "Manage watch rules" })).toBeVisible({ timeout: 15000 });

    const createResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST"
        && url.pathname === "/api/watch-rules"
        && response.status() === 201;
    });
    await page.getByRole("button", { name: "Manage watch rules" }).click();
    const editor = page.getByRole("dialog", { name: "Create watch rule" });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Rule name").fill(ruleName);
    await editor.getByLabel("Alert kind").fill("c3_e2e_activation");
    await editor.getByLabel("Alert title").fill(alertTitle);
    await editor.getByLabel("Alert impact").fill("Verify the durable C3 activation path.");
    await editor.getByRole("button", { name: "Save rule" }).click();
    createdRule = await (await createResponse).json() as CreatedWatchRule;

    try {
      await expect(page.getByRole("status").filter({ hasText: "Rule created." })).toBeVisible();
      const observation = {
        source_identity: `e2e:monitor:${marker}`,
        observed_at: "2026-07-21T12:00:00Z",
        numeric_value: null,
        categorical_value: "critical",
        detail: { scenario: "c3-real-api" },
        source_artifact_refs: [`e2e:monitor:${marker}`],
        hop_count: 0,
      };
      const evaluatePath = `/api/watch-rules/${createdRule.id}/evaluate`;
      const firstResponse = await request.post(evaluatePath, { data: observation });
      expect(firstResponse.ok(), await firstResponse.text()).toBeTruthy();
      const first = await firstResponse.json() as ManualEvaluation;
      expect(first).toMatchObject({ outcome: "matched", created: true });
      expect(first.alert_event_id).toBeTruthy();

      const replayResponse = await request.post(evaluatePath, { data: observation });
      expect(replayResponse.ok(), await replayResponse.text()).toBeTruthy();
      const replay = await replayResponse.json() as ManualEvaluation;
      expect(replay).toEqual({ ...first, created: false });

      const eventId = first.alert_event_id!;
      await page.reload();
      let row = page.locator(`[data-alert-event-id="${eventId}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      await expect(row.getByRole("heading", { name: alertTitle })).toBeVisible();

      let patchAttempts = 0;
      let injectedFailures = 0;
      await page.route(`**/api/alerts/events/${eventId}`, async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.fallback();
          return;
        }
        patchAttempts += 1;
        if (injectedFailures === 0) {
          injectedFailures += 1;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Injected one-shot event PATCH failure" }),
          });
          return;
        }
        await route.continue();
      });

      const selected = row.getByRole("checkbox", { name: `Select ${alertTitle}` });
      const assigneeDraft = row.getByLabel("Alert assignee");
      await selected.check();
      await assigneeDraft.fill("Draft owner remains local");
      await row.getByRole("button", { name: "Ack", exact: true }).click();

      await expect(row.getByRole("alert")).toContainText("Input was preserved.");
      await expect(selected).toBeChecked();
      await expect(assigneeDraft).toHaveValue("Draft owner remains local");
      expect({ patchAttempts, injectedFailures }).toEqual({ patchAttempts: 1, injectedFailures: 1 });

      const retryResponse = page.waitForResponse((response) =>
        response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/alerts/events/${eventId}`
        && response.ok(),
      );
      await row.getByRole("button", { name: "Retry", exact: true }).click();
      await retryResponse;
      await expect(row).toContainText("Acknowledged");
      await expect(selected).toBeChecked();
      await expect(assigneeDraft).toHaveValue("Draft owner remains local");
      expect({ patchAttempts, injectedFailures }).toEqual({ patchAttempts: 2, injectedFailures: 1 });

      await page.reload();
      row = page.locator(`[data-alert-event-id="${eventId}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      await expect(row).toContainText("Acknowledged");
    } finally {
      const cleanupResponse = await request.patch(`/api/watch-rules/${createdRule.id}`, {
        data: {
          expected_version: createdRule.current_version,
          patch: { enabled: false },
        },
      });
      expect(cleanupResponse.ok(), await cleanupResponse.text()).toBeTruthy();
    }
  });
});
