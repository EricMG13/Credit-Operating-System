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
 *     BUILD-STALENESS NOTE: the exact "AI-synthesized" provenance-marker text
 *     lives in ReportPane.tsx:286 in *source*, but the static build the QA
 *     server serves is ~2 days old (page-a0bab7efb8101366.js) and predates that
 *     marker — its live footer is a bare "N sources", with no "AI-synthesized"
 *     span. So the specific "AI-synthesized" text assertion is split into its
 *     own test.skip()-guarded case below; the green E2E-6c test asserts the
 *     live-provenance signals that ARE in the deployed build.
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
  test("un-stubbed demo run renders the real server report [E2E-6a]", async ({ page }) => {
    await page.goto("/research/");

    await expect(page.getByRole("heading", { name: "Research brief" })).toBeVisible({
      timeout: 15000,
    });

    // Unique subject per run so nothing about the request collides across runs.
    const subject = `E2E Enterprise Software ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await page.getByLabel("Sector / theme").fill(subject);

    // Demo-mode label is "Run example research" (no key). The regex tolerates a
    // key-configured server ("Run deep research") but the assertions below
    // assume the demo report; see the describe-block note.
    const run = page.getByRole("button", { name: /Run (deep|example) research/ });
    await expect(run).toBeEnabled();
    await run.click();

    // The demo executor completes on the first poll, so the report replaces the
    // running view quickly. Assert against the demo report's stable structure:
    // the DEMO badge, the report's Executive Summary H2, and the honest
    // "Illustrative · demo" provenance footer (0 structured sources).
    await expect(page.getByText("DEMO", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Executive Summary" }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Detailed Findings").first()).toBeVisible({
      timeout: 15000,
    });

    // Demo reports carry no citations → footer says "Illustrative · demo" and
    // the "Sources (N)" section is intentionally absent (see the note above).
    await expect(page.getByText("Illustrative · demo").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Sources \(\d+\)/)).toHaveCount(0);

    // EXPORT PDF appears once a report is filed — the run truly completed.
    await expect(page.getByRole("button", { name: "EXPORT PDF" })).toBeVisible({
      timeout: 15000,
    });
  });

  // ── E2E-6c ────────────────────────────────────────────────────────────────
  // Stubbed LIVE run: a completed job with demo:false + cited sources. Asserts
  // the live render branch present in the deployed build — the "● LIVE" badge,
  // the "Sources (N)" citation section, the sources link, and that the demo
  // footer does NOT show. Mirrors research_flow.spec.ts:47-69 with demo:false.
  test("live run shows the live-provenance render branch [E2E-6c]", async ({ page }) => {
    // POST creates a job; the client then polls GET to completion.
    await page.route("**/api/research", (route) =>
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
    const run = page.getByRole("button", { name: /Run (deep|example) research/ });
    await expect(run).toBeEnabled();
    await run.click();

    // Live badge renders (not the DEMO badge) — the demo:false provenance path.
    await expect(page.getByText("● LIVE", { exact: true })).toBeVisible({ timeout: 15000 });
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
  // The specific "AI-synthesized" provenance-marker text (ReportPane.tsx:189-191).
  // Source-present + unit-guarded (report-provenance.test.tsx); this browser leg
  // needs a bundle rebuilt from current source (the marker post-dates the served
  // 2026-07-02 static build). Un-skip once caos/server/static is rebuilt/redeployed.
  test.skip("live run shows the AI-synthesized marker text [E2E-6c marker]", async ({ page }) => {
    await page.route("**/api/research", (route) =>
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
    await page.getByRole("button", { name: /Run (deep|example) research/ }).click();

    await expect(page.getByText("● LIVE", { exact: true })).toBeVisible({ timeout: 15000 });
    // The badge marker + the tear-sheet footer both name the LLM synthesis.
    await expect(page.getByText("AI-synthesized").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/AI-synthesized · 2 sources/).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Illustrative · demo")).toHaveCount(0);
  });
});
