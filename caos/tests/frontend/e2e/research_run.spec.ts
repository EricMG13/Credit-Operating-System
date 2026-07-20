/**
 * Playwright E2E: Deep Research — journey-6 gaps E2E-6a and E2E-6c.
 *
 * Complements research_flow.spec.ts (do NOT edit that file). Two legs the
 * existing spec does not cover:
 *
 *   E2E-6a — UN-STUBBED demo run. Fills the brief and clicks the REAL
 *     "Run example research" button, letting the actual POST /api/research +
 *     poll GET run to completion. No page.route — this exercises the whole
 *     durable-job path (create → enqueue → executor → poll → render) against
 *     the demo executor. The QA server runs in demo-fallback mode (no model
 *     key), so run_deep_research() returns the canned demo report from
 *     deepresearch_demo.md immediately (probed: job is `complete` on the first
 *     poll, ~0.02s). This proves the page renders a real server-produced
 *     report, not a stubbed one.
 *
 *     NB on `Sources (N)`: the DEMO report carries NO structured citations
 *     (run_deep_research returns ResearchResult(report=…, demo=True) with an
 *     empty sources list — deepresearch.py:238). So `sources.length === 0`, and
 *     ReportPane gates the "Sources (N)" section on a non-empty source list.
 *     The honest demo footer is "Illustrative · demo" (ReportPane.tsx:190). We
 *     therefore assert the demo footer here and cover "Sources (N)" in the
 *     stubbed E2E-6c leg below, where demo:false + a real source list renders
 *     it.
 *
 *   E2E-6c — LIVE AI-provenance marker. Stubs the research endpoints to return
 *     a completed job with demo:false + cited sources (mirrors
 *     research_flow.spec.ts:47-69 but demo:false), and asserts the LIVE render
 *     branch — the "● LIVE" badge, the "Sources (N)" citation section, and that
 *     the demo footer ("Illustrative · demo") does NOT show. A real live run
 *     needs a model key (multi-minute web search) and cannot complete offline,
 *     so the stub is the only way to exercise the demo:false branch here.
 *
 *     The current production export includes the exact "AI-synthesized"
 *     tear-sheet marker, covered in its own focused browser case below.
 *
 * Run (from caos/frontend):
 *   PLAYWRIGHT_BASE_URL='http://localhost:8010' E2E_ACCESS_CODE='131113' \
 *     NODE_PATH=node_modules npx playwright test research_run --reporter=list
 *
 * Auth is handled once in global-setup (storageState); pages render signed-in.
 */

import { test, expect } from "@playwright/test";

test.describe("Deep Research — un-stubbed run & live provenance", () => {
  // ── E2E-6a ────────────────────────────────────────────────────────────────
  // Real POST + poll against the demo executor — NOT stubbed. The QA server is
  // in demo-fallback mode, so the run resolves to the canned report instantly.
  // If this leg ever runs against a KEY-configured server it would kick off a
  // real multi-minute web search and time out — hence it is scoped to the demo
  // path and gated on the "Run example research" (demo-mode) button label.
  test("un-stubbed no-key workspace fails closed without presenting demo output [E2E-6a]", async ({ page }) => {
    await page.goto("/research/");

    await expect(page.getByRole("heading", { name: "Research brief" })).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByText("Live unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run deep research" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open reference example" })).toBeVisible();
    await expect(page.getByText("DEMO", { exact: true })).toHaveCount(0);
  });

  // ── E2E-6c ────────────────────────────────────────────────────────────────
  // Stubbed LIVE run: a completed job with demo:false + cited sources. Asserts
  // the live render branch present in the deployed build — the "● LIVE" badge,
  // the "Sources (N)" citation section, the sources link, and that the demo
  // footer does NOT show. Mirrors research_flow.spec.ts:47-69 with demo:false.
  test("live run shows the live-provenance render branch [E2E-6c]", async ({ page }) => {
    await page.route((url) => url.pathname === "/api/settings", (route) =>
      route.fulfill({ json: { llm_configured: true } }),
    );
    // POST creates a job; the client then polls GET to completion.
    await page.route((url) => url.pathname === "/api/research", (route) =>
      route.fulfill({ status: 201, json: { id: "live-job-1", status: "running" } }),
    );
    // First GET reports `running` (client must loop), the second `complete`
    // with demo:false — the live render branch under test.
    let polls = 0;
    await page.route("**/api/research/*", (route) => {
      polls += 1;
      if (polls < 2) {
        route.fulfill({ json: { id: "live-job-1", status: "running" } });
        return;
      }
      route.fulfill({
        json: {
          id: "live-job-1",
          status: "complete",
          report:
            "## Executive Summary\n\nNet leverage is elevated.\n\n## Detailed Findings\n\nDetail.",
          sources: [
            { title: "Example credit filing", url: "https://example.com/filing" },
            { title: "Rating action", url: "https://example.com/rating" },
          ],
          demo: false,
          truncated: false,
        },
      });
    });

    await page.goto("/research/");
    const subject = `Live Marker Probe ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await page.getByLabel("Sector / theme").fill(subject);
    const run = page.getByRole("button", { name: "Run deep research" });
    await expect(run).toBeEnabled();
    await run.click();

    // Live badge renders (not the DEMO badge) — the demo:false provenance path.
    // Status meaning is now conveyed by the explicit text label rather than a
    // decorative bullet, preserving the same provenance assertion.
    await expect(page.getByText("LIVE", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("DEMO", { exact: true })).toHaveCount(0);

    // The report + its cited sources render, and the demo footer never shows —
    // provenance is honest about a live, source-backed report.
    await expect(page.getByRole("heading", { name: "Executive Summary" }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Sources (2)").first()).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("link", { name: "Example credit filing" }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Illustrative · demo")).toHaveCount(0);
  });

  // ── E2E-6c (exact marker) ───────────────────────────────────────────────────
  // The specific current provenance-marker text in the on-screen tear-sheet.
  test("live run shows the AI-synthesized marker text [E2E-6c marker]", async ({ page }) => {
    await page.route((url) => url.pathname === "/api/settings", (route) =>
      route.fulfill({ json: { llm_configured: true } }),
    );
    await page.route((url) => url.pathname === "/api/research", (route) =>
      route.fulfill({ status: 201, json: { id: "live-job-2", status: "running" } }),
    );
    let polls = 0;
    await page.route("**/api/research/*", (route) => {
      polls += 1;
      if (polls < 2) {
        route.fulfill({ json: { id: "live-job-2", status: "running" } });
        return;
      }
      route.fulfill({
        json: {
          id: "live-job-2",
          status: "complete",
          report: "## Executive Summary\n\nX.\n\n## Detailed Findings\n\nY.",
          sources: [
            { title: "Example credit filing", url: "https://example.com/filing" },
            { title: "Rating action", url: "https://example.com/rating" },
          ],
          demo: false,
          truncated: false,
        },
      });
    });

    await page.goto("/research/");
    await page
      .getByLabel("Sector / theme")
      .fill(`Marker Probe ${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    await page.getByRole("button", { name: "Run deep research" }).click();

    await expect(page.getByText("LIVE", { exact: true })).toBeVisible({ timeout: 15000 });
    // The badge marker + the tear-sheet footer both name the LLM synthesis.
    await expect(page.getByText("AI-synthesized").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/AI-synthesized · 2 sources/).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Illustrative · demo")).toHaveCount(0);
  });
});
