/**
 * Playwright E2E — Journey 1: the bootstrap workflow (gap E2E-1b, the sweep's
 * one HIGH). This is the app's primary path — create an issuer, trigger the
 * analytical engine, run it to completion, and see the run's output surface in
 * the UI — and it was previously untested past the pre-upload wizard.
 *
 * The engine runs KEYLESS / deterministic (demo-fallback) on the single-process
 * QA server, so a real run is fully exercisable offline. A probe against the
 * live server confirmed a keyless run terminates ~instantly at status
 * "complete" with all 23 modules produced (a fresh issuer with no documents
 * clears to committee_status "Restricted" — insufficient data, but a clean
 * deterministic terminal, which is exactly what a bootstrap smoke test wants).
 *
 * Flow under test:
 *   (1) create a uniquely-named issuer            — POST /api/issuers  (beforeAll)
 *   (2) trigger a run for it                       — POST /api/runs     (beforeAll)
 *   (3) poll the run to a terminal state           — GET  /api/runs/{id}
 *   (4) assert the run OUTPUT is visible in the UI  — /pipeline + /deepdive
 *
 * The upload wizard (CP-0 document intake) does NOT itself kick off a run — it
 * only ingests documents — so the run is created via the createRun API
 * (POST /api/runs {issuer_id}), exactly as the app's own api.ts createRun does.
 * The wizard's reachable pre-run UI is still exercised (test 5) so the whole
 * bootstrap chrome is covered.
 *
 * Auth is handled once in global-setup (storageState); pages render signed-in.
 * Assertions key on stable roles/text and run-scoped ids, never exact figures —
 * the served static build lags the source by a couple of days.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

// Unique per run: display names AND emails are unique-constrained, so a reused
// name 409s. Time + random keeps parallel/retried runs from colliding.
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ISSUER_NAME = `Bootstrap Journey Corp ${UNIQUE}`;

// A keyless run is deterministic and near-instant, but give the poll real room
// (the task allows up to 120s) so a cold/slow server never flakes this.
const RUN_TERMINAL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

// Terminal run states: a keyless run should land on "complete"; we treat
// "failed" as terminal too so a broken run ends the poll loop with a clear
// assertion rather than timing out.
const TERMINAL = new Set(["complete", "failed"]);

interface RunModule { module_id: string; module_name: string; committee_status: string; qa_status: string }
interface RunSummary {
  id: string;
  status: string;
  qa_status: string;
  committee_status: string;
  modules: RunModule[];
}

// Poll GET /api/runs/{id} until the run reaches a terminal status (or timeout).
async function pollRunToTerminal(api: APIRequestContext, runId: string): Promise<RunSummary> {
  const deadline = Date.now() + RUN_TERMINAL_TIMEOUT_MS;
  let last: RunSummary | null = null;
  while (Date.now() < deadline) {
    const res = await api.get(`/api/runs/${runId}`);
    expect(res.ok()).toBeTruthy();
    last = (await res.json()) as RunSummary;
    if (TERMINAL.has(last.status)) return last;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Run ${runId} did not reach a terminal state within ${RUN_TERMINAL_TIMEOUT_MS}ms ` +
      `(last status: ${last?.status ?? "unknown"})`,
  );
}

test.describe("Bootstrap journey — create → run → output", () => {
  // Shared across the describe: the issuer we create and the run we trigger for
  // it in beforeAll. Populated once; every UI test reads the same run's output.
  let issuerId = "";
  let runId = "";
  let terminal: RunSummary;

  test.beforeAll(async ({ playwright }) => {
    // A dedicated request context on the same base URL + signed-in storageState,
    // so the bootstrap (issuer + run creation + polling) runs through the real
    // authenticated API exactly as the UI would.
    const api = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000",
      storageState: "../tests/frontend/e2e/.auth/state.json",
    });

    // (1) Create a uniquely-named issuer.
    const issuerRes = await api.post("/api/issuers/", {
      data: { name: ISSUER_NAME, ticker: "BJC", industry: "Testing", country: "US" },
    });
    expect(issuerRes.ok(), `issuer create failed: ${issuerRes.status()}`).toBeTruthy();
    issuerId = (await issuerRes.json()).id as string;
    expect(issuerId).toBeTruthy();

    // (2) Trigger a run — the createRun contract is POST /api/runs {issuer_id}.
    const runRes = await api.post("/api/runs", { data: { issuer_id: issuerId } });
    expect(runRes.ok(), `run create failed: ${runRes.status()}`).toBeTruthy();
    const created = (await runRes.json()) as RunSummary;
    runId = created.id;
    expect(runId).toBeTruthy();

    // (3) Poll to a terminal state (deterministic, keyless demo-fallback engine).
    terminal = await pollRunToTerminal(api, runId);

    await api.dispose();
  });

  test("keyless run completes deterministically with module output", async () => {
    // The deterministic backbone: a keyless run terminates at "complete" and
    // produces engine modules. This is the one guaranteed-green assertion about
    // a completed run — it does not depend on the (older) static UI build.
    expect(terminal.status).toBe("complete");
    // The run carries a committee/QA verdict (a fresh no-document issuer clears
    // to a non-Committee-Ready status — assert only that it is a real, non-empty
    // verdict, never an exact value the methodology might re-tune).
    expect(terminal.committee_status).toBeTruthy();
    expect(terminal.qa_status).toBeTruthy();
    // The full CP-X route produced a substantial module set (CP-0…CP-6E).
    expect(terminal.modules.length).toBeGreaterThan(15);
    // The QA gate module (CP-5) and the canonical data foundation (CP-1) are
    // both present — the run walked the whole pipeline, not a stub.
    const ids = new Set(terminal.modules.map((m) => m.module_id));
    expect(ids.has("CP-1")).toBeTruthy();
    expect(ids.has("CP-5")).toBeTruthy();
    expect(ids.has("CP-X")).toBeTruthy();
  });

  test("run appears in listRuns for its issuer (complete)", async ({ request }) => {
    // The create→trigger→appears reachable leg via the runs list endpoint that
    // backs listRuns() — the same query the Pipeline page uses to discover the
    // latest complete run for an issuer.
    const res = await request.get(`/api/runs?issuer_id=${issuerId}`);
    expect(res.ok()).toBeTruthy();
    const runs = (await res.json()) as Array<{ id: string; status: string; issuer_id: string }>;
    const mine = runs.find((r) => r.id === runId);
    expect(mine, "the triggered run should be listed for its issuer").toBeTruthy();
    expect(mine!.status).toBe("complete");
    expect(mine!.issuer_id).toBe(issuerId);
  });

  test("Pipeline reflects the completed live run for the issuer", async ({ page }) => {
    // The RUN <prefix> accent label is gated to ≥2xl (1536px); go wide so the
    // run-scoped id is on screen for a precise, run-specific assertion.
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`/pipeline/?issuer=${issuerId}`);

    // A completed live run flips the page to LIVE mode: the header names the
    // live CP-X run and stamps the run-id prefix (both are live-run-specific —
    // the offline demo shows "Atlas Forge — …" and a fixed demo run id).
    // The live header names the issuer then "— live CP-X run" (issuer-prefixed for
    // any non-reference issuer); the offline demo ends "… for the reference issuer".
    // Anchor on the live suffix so it matches the live header for any issuer.
    await expect(page.getByText(/live CP-X run$/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`RUN ${runId.slice(0, 8)}`, { exact: false })).toBeVisible({
      timeout: 15000,
    });

    // The workbench now reports deterministic module completion in its decision
    // header instead of duplicating the committee verdict as a clearance tag.
    await expect(page.getByText(/23\/23 modules/i)).toBeVisible({ timeout: 15000 });

    // The execution graph renders the pipeline module nodes (e.g. the CP-5 QA
    // clearance node) — the route graph is populated for this run.
    await expect(page.getByText("CP-5", { exact: true }).first()).toBeVisible({ timeout: 15000 });
  });

  test("Deep-Dive renders this issuer's live engine output", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`/deepdive/?issuer=${issuerId}`);

    // The chrome is labelled with the issuer we created (not the ATLF reference
    // deal) — the deep-dive is scoped to this bootstrap issuer.
    await expect(page.getByText(ISSUER_NAME, { exact: false }).first()).toBeVisible({ timeout: 15000 });

    // The live-run honesty caveat only renders when a completed run exists for
    // the issuer (deepDiveCaveatKind === "live") — a direct signal that the run
    // reached the UI, not a seeded fixture. Match the badge's FULL text: the
    // bare phrase also appears in the tabs caveat note and the rail's no-output
    // note once live module content renders, so the loose locator only passed
    // while it raced ahead of the data (strict-mode violation once the page
    // loads fast enough).
    await expect(
      page.getByText("live engine output · missing panes show no output")
    ).toBeVisible({
      timeout: 15000,
    });

    // The default (CP-1) module tab renders genuinely-live output → the per-
    // module ● LIVE provenance badge. This is the assertion that the run's
    // OUTPUT (not just its existence) is on screen.
    await expect(page.getByText("● LIVE", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });

    // The live export remains one interaction away in the shell utility drawer.
    await page.getByRole("button", { name: /Open Layout and simulation/i }).click();
    await expect(page.getByText("EXPORT TO VAULT", { exact: false })).toBeVisible({
      timeout: 15000,
    });
  });

  test("upload wizard reaches the files & run-mode step for the issuer", async ({ page }) => {
    // The bootstrap chrome's reachable pre-run UI: the CP-0 document-intake
    // wizard advances from issuer selection to the files + run-mode step. The
    // wizard ingests documents (it does not itself start the run — that is the
    // createRun path exercised above), so this covers the wizard leg without a
    // real file drop.
    await page.goto("/upload/");
    await expect(page.getByText("Select issuer", { exact: false })).toBeVisible({ timeout: 15000 });

    // Pick the issuer we created (its row is a button labelled with the name).
    await page.getByRole("button", { name: new RegExp(ISSUER_NAME) }).click();

    // Step 02 — the drop zone + run-mode selector for the whole committee route.
    await expect(page.getByText("Drop all deal documents", { exact: false })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Full IC Committee", { exact: true })).toBeVisible();
  });
});
