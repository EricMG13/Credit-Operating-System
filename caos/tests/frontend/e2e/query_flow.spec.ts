/**
 * Playwright E2E: persisted Query investigation → evidence handoff.
 *
 * The Query surface is intentionally explicit: it does not execute on page
 * load, the analyst chooses (or accepts inference of) a lane, and the selected
 * persisted run is URL-addressable. Command links here instead of mounting a
 * second table-producing query surface.
 */

import { test, expect, type Page } from "@playwright/test";

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function runInvestigation(page: Page, question: string) {
  const composer = page.getByRole("textbox", { name: "Query coverage" });
  await expect(composer).toBeVisible({ timeout: 15000 });
  await composer.fill(question);
  const run = page.getByRole("button", { name: "Run Query", exact: true });
  await expect(run).toBeEnabled({ timeout: 15000 });
  await run.click();
  await expect(page).toHaveURL(/(?:\?|&)run=/, { timeout: 15000 });
  const title = page.locator('[aria-label="Query answer"]').getByRole("heading", { level: 2 }).first();
  await expect(title).toBeVisible({ timeout: 15000 });
  return title;
}

test.describe("Query — persisted investigation workbench", () => {
  // These tests intentionally mutate the same analyst's active persisted
  // context. Keep them serial so one browser cannot replace another browser's
  // query_session_id while the first is asserting URL restoration.
  test.describe.configure({ mode: "serial" });
  test("opens ready and runs a metric investigation in the dominant region", async ({ page }) => {
    await page.goto("/query/");

    await expect(page.getByRole("heading", { name: "Ask one cross-coverage question." })).toBeVisible({ timeout: 15000 });
    const title = await runInvestigation(page, `which issuer is most levered ${uniq()}`);
    expect(((await title.textContent()) ?? "").trim().length).toBeGreaterThan(0);
    await expect(page).toHaveURL(/(?:\?|&)run=/);
    await expect(page.getByRole("button", { name: "metric", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("graph intent is explicit and URL-addressable", async ({ page }) => {
    await page.goto("/query/");
    await page.getByRole("button", { name: "graph", exact: true }).click();
    await expect(page).toHaveURL(/(?:\?|&)lane=graph(?:&|$)/);
    await expect(page.getByRole("button", { name: "graph", exact: true })).toHaveAttribute("aria-pressed", "true");
    await runInvestigation(page, `show the relationship graph for refinancing risk ${uniq()}`);
    await expect(page.getByRole("button", { name: "graph", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/(?:\?|&)lane=graph(?:&|$)/);
    await expect(page).toHaveURL(/(?:\?|&)run=/);
  });

  test("selected investigation survives reload", async ({ page }) => {
    await page.goto("/query/");
    const title = await runInvestigation(page, `compare recovery assumptions ${uniq()}`);
    const before = ((await title.textContent()) ?? "").trim();
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(
      page.locator('[aria-label="Query answer"]').getByRole("heading", { level: 2 }).first(),
    ).toHaveText(before, { timeout: 15000 });
  });
});

test.describe("Command → Query handoff", () => {
  test("Command keeps one dominant worklist and deep-links cross-coverage investigation", async ({ page }) => {
    await page.goto("/command/");
    await expect(page.getByRole("textbox", { name: "Ask a question across issuers" })).toHaveCount(0);
    const queryLink = page.getByRole("link", { name: /Open cross-issuer Query/i }).first();
    await expect(queryLink).toBeVisible({ timeout: 15000 });
    await queryLink.click();
    await expect(page).toHaveURL(/\/query/);
    await expect(page.getByRole("textbox", { name: "Query coverage" })).toBeVisible({ timeout: 15000 });
  });
});
