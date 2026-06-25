/**
 * Playwright E2E: Deep Research concept (/research).
 *
 * Runs against the single-process server (FastAPI serving API + static
 * frontend). The run test stubs /api/research at the network boundary — with a
 * model key that endpoint runs a real multi-minute web search, so we don't
 * depend on the server's key config; we test that the frontend renders the
 * returned report. The non-run tests exercise the live page as-served.
 *
 * Build the frontend first (scripts/build_frontend.sh), then run the server:
 * python caos/server/run.py
 */

import { test, expect } from "@playwright/test";

// Auth is handled once in global-setup (storageState); pages render signed-in.
test.describe("Deep Research", () => {
  test("renders the brief form with an empty report", async ({ page }) => {
    await page.goto("/research/");

    await expect(page.getByRole("heading", { name: "Research brief" })).toBeVisible({
      timeout: 10000,
    });
    // Run is gated until a subject is entered.
    // Label is "Run deep research" with a key, "Run example research" in demo mode (CI has no key).
    await expect(page.getByRole("button", { name: /Run (deep|example) research/ })).toBeDisabled();
    await expect(page.getByText("No report yet")).toBeVisible();
  });

  test("scope toggle swaps the subject field between sector and issuer", async ({ page }) => {
    await page.goto("/research/");

    // Default scope is sector.
    const sector = page.getByRole("button", { name: "sector" });
    const issuer = page.getByRole("button", { name: "issuer" });
    await expect(sector).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Sector / theme", { exact: true })).toBeVisible();

    await issuer.click();
    await expect(issuer).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Issuer", { exact: true })).toBeVisible();
  });

  test("running deep research renders the returned report and sources", async ({ page }) => {
    // Durable flow (M-3): POST creates a job, the client polls GET to completion.
    // Stub both so the run is fast and deterministic (no real web search / key).
    await page.route("**/api/research", (route) =>
      route.fulfill({ status: 201, json: { id: "job-1", status: "running" } }),
    );
    // Poll-again coverage: the first GET reports `running` (client must loop), the
    // second reports `complete` — exercises the central durable-poll behavior.
    let polls = 0;
    await page.route("**/api/research/*", (route) => {
      polls += 1;
      if (polls < 2) {
        route.fulfill({ json: { id: "job-1", status: "running" } });
        return;
      }
      route.fulfill({
        json: {
          id: "job-1",
          status: "complete",
          report: "## Executive Summary\n\nNet leverage is elevated.\n\n## Detailed Findings\n\nDetail.",
          sources: [{ title: "Example credit filing", url: "https://example.com/filing" }],
          demo: true,
          truncated: false,
        },
      });
    });

    await page.goto("/research/");
    await page.getByLabel("Sector / theme").fill("Enterprise Software");
    const run = page.getByRole("button", { name: /Run (deep|example) research/ });
    await expect(run).toBeEnabled();
    await run.click();

    await expect(page.getByText("DEMO", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Executive Summary" })).toBeVisible();
    // Cited sources render in the footer.
    await expect(page.getByText("Sources (1)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Example credit filing" })).toBeVisible();
  });
});
