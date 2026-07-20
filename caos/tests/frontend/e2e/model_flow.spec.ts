/**
 * Playwright E2E: The Model Builder (/model) — journey 3, gaps E2E-3a/3b/3c.
 *
 * Runs against the single-process QA server (FastAPI serving the API + the
 * static Next export on one origin). Read-only reference-fixture checks use bare
 * /model. Durable save/reload checks discover the explicit sanitized QA workflow
 * issuer. A clean CI database creates that issuer and submits an explicitly
 * analyst-authored, sanitized suggestion through the real calculation/save
 * endpoints; no synthetic CP-1 run is relabelled as live evidence.
 * We assert on stable roles / text from the current production export, never on
 * exact model values other than a value this test itself persists.
 *
 * Auth is handled once in global-setup (storageState); pages render signed-in —
 * do NOT add per-test login (per-test auth trips the 10/min login rate limit).
 *
 * The worksheet uses aria-label="Model worksheet" rather than role="grid".
 * A 1500px viewport keeps both flank panels expanded. Header overflow may still
 * place contextual actions in the labeled Model v2 tools drawer.
 */

import { expect, test } from "./fixtures";

let workflowIssuerId = "";

const E2E_MODEL_PAYLOAD = {
  schema_version: 2,
  reporting_currency: "USD",
  reporting_unit: "millions",
  periods: [{
    period_key: "FY2026",
    label: "E2E FY26",
    kind: "forecast",
    months: 12,
    revenue: 800,
    reported_ebitda: 100,
    adjustments: 10,
    cash: 20,
    taxes: 5,
    capex: 10,
    working_capital_change: -2,
    other_cash_flow: 0,
    authority: { origin: "analyst", method: "e2e-sanitized", source_ids: [] },
  }],
  debt_instruments: [{
    instrument_id: "e2e-tlb-1",
    name: "Sanitized first-lien term loan",
    priority: 1,
    seniority: "1L",
    currency: "USD",
    rate_type: "floating",
    authority: { origin: "analyst", method: "e2e-sanitized", source_ids: [] },
    periods: [{
      period_key: "FY2026",
      opening_balance: 200,
      closing_balance: 190,
      draws: 0,
      repayments: 10,
      scheduled_amortization: 0,
      commitment: 220,
      benchmark_rate: 0.04,
      floor_rate: 0.05,
      spread_rate: 0.03,
      coupon_rate: 0.01,
      commitment_fee_rate: 0.005,
      pik_rate: 0,
      cash_fees: 1,
      hedge_effect: -0.5,
      fx_rate: 1,
    }],
  }],
  overrides: [],
  ui_preferences: {},
  source_ids: [],
};

// Wide viewport: keeps both flank panels expanded and un-hides the SAVED status
// (hidden below the xl / 1280px breakpoint in the served build).
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
});

test.describe("Model Builder", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async ({ request }) => {
    const response = await request.get("/api/issuers/?q=Granite%20Peak%20Healthcare");
    expect(response.ok()).toBe(true);
    const issuers = await response.json() as Array<{ id: string; name: string }>;
    let fixture = issuers.find((issuer) => issuer.name === "Granite Peak Healthcare");
    if (!fixture) {
      const created = await request.post("/api/issuers/", {
        data: {
          name: "Granite Peak Healthcare",
          ticker: "GPHQ",
          industry: "Healthcare",
          country: "US",
        },
      });
      expect(created.ok(), `model fixture issuer create failed: ${created.status()}`).toBe(true);
      fixture = await created.json() as { id: string; name: string };
    }
    expect(fixture.name).toBe("Granite Peak Healthcare");
    workflowIssuerId = fixture.id;

  });
  // [3b] The engine-provenance badge renders (LIVE CP-1 anchor, or the seeded
  // demo fallback) — the model is grounded, not blank.
  test("provenance badge renders the CP-1 anchor state", async ({ page }) => {
    await page.goto("/model/?mode=reference");

    // Worksheet grid confirms the issuer-model branch rendered (not the
    // "No issuer-specific model output" empty state).
    await expect(page.getByLabel("Model worksheet")).toBeVisible({ timeout: 15000 });

    // ProvenanceChip (lib/provenance.ts fromModelEngine, RT-2026-07-11-65):
    // origin renders as a bare "LIVE" or "DEMO" chip — the old per-surface
    // "CP-1 LIVE" / "SEEDED · demo RUN" copy was unified away. Either origin
    // proves the grid is sourced. Anchored regex avoids matching "LIVE"/"DEMO"
    // as a substring elsewhere on the page.
    await expect(page.getByText(/^(LIVE|DEMO)$/).first()).toBeVisible({
      timeout: 15000,
    });
  });

  // [3a] Scenario leg: open the Scenario panel, apply a preset, and assert the
  // best/base/worst lens re-centers on it. The "Downside fragility · CP-2B"
  // readout is skipped separately below — it needs a run that produced CP-2B,
  // which the offline demo-fallback run does not.
  test("applying a scenario preset re-centers the best/base/worst lens", async ({ page }) => {
    await page.goto("/model/?mode=reference");
    await expect(page.getByLabel("Model worksheet")).toBeVisible({ timeout: 15000 });

    // Support surfaces are selected explicitly through the shared toolbar;
    // viewport width no longer auto-mounts the Scenario panel.
    await page
      .getByRole("group", { name: "Model support" })
      .getByRole("button", { name: "Scenario" })
      .click();
    await expect(
      page.getByText("Scenario & Sensitivity · forward cash-flow lens"),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Best · base · worst/)).toBeVisible();

    // Apply the "Rate hike +200bps" preset chip.
    await page.getByRole("button", { name: "Rate hike +200bps" }).click();

    // The comparison header shows the active-scenario pill "▸ Rate hike +200bps",
    // and the Scenario Builder surfaces its RESET (revert-to-module) control.
    await expect(page.getByText("▸ Rate hike +200bps")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "↶ RESET" })).toBeVisible();
  });

  // [3a — DownsideFragility sub-leg] The local run may legitimately omit CP-2B.
  // Stub only that optional read with the canonical DTO shape while retaining
  // the real run, CP-1 anchor, page, and rendering path.
  test("downside fragility (CP-2B) readout renders", async ({ page }) => {
    // The demo seed creates the reference issuer/model storage contract but not
    // a completed analytical run. Supply one exact completed run plus its CP-1
    // anchor so useModelEngine follows the same live module-fetch path as prod.
    await page.route((url) => url.pathname === "/api/runs" && url.searchParams.has("issuer_id"), (route) => route.fulfill({
      json: [{
        id: "e2e-model-run",
        issuer_id: "a71f0000-0000-0000-0000-000000000001",
        status: "complete",
        qa_status: "Restricted",
        committee_status: "Restricted",
        as_of_date: "2026-05-31",
        created_at: "2026-07-16T00:00:00Z",
      }],
    }));
    await page.route("**/api/runs/e2e-model-run/modules/CP-1", (route) => route.fulfill({
      json: {
        module_id: "CP-1",
        module_name: "CanonicalDataFoundation",
        owned_object: "canonical_financials",
        schema_family: "Nested",
        runtime_output: {
          normalized_financials: {
            revenue: { LTM_Q1_26: 2801 },
            adj_ebitda: { LTM_Q1_26: 421 },
            net_debt_ltm: 2391,
            net_leverage_adj_ltm: 5.68,
            interest_coverage_ltm: 2.1,
          },
        },
        confidence: "Medium",
        qa_status: "Restricted",
        committee_status: "Restricted",
        validation_status: "Passed",
        limitation_flags: [],
        downstream_consumers: ["CP-2"],
        claims: [],
      },
    }));
    await page.route("**/api/runs/*/modules/CP-2B", (route) => route.fulfill({
      json: {
        module_id: "CP-2B",
        module_name: "DownsidePathway",
        owned_object: null,
        schema_family: "runtime",
        runtime_output: {
          current_net_leverage: 5.68,
          breach_threshold_x: 7.0,
          fragility: "MODERATE",
          shock_to_breach_pct: 20,
          scenarios: [
            { ebitda_shock_pct: 10, stressed_net_leverage: 6.31, stressed_interest_coverage: 1.89 },
            { ebitda_shock_pct: 20, stressed_net_leverage: 7.1, stressed_interest_coverage: 1.68 },
          ],
        },
        confidence: "High",
        qa_status: "Passed",
        committee_status: "Restricted",
        validation_status: "Passed",
        limitation_flags: [],
        downstream_consumers: ["CP-3D", "CP-6A"],
        claims: [],
      },
    }));
    await page.goto("/model/?mode=reference");
    await page
      .getByRole("group", { name: "Model support" })
      .getByRole("button", { name: "Scenario" })
      .click();
    await expect(page.getByText("Downside fragility · CP-2B", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTitle("First-order EBITDA-shock fragility: MODERATE")).toContainText("MODERATE");
    await expect(page.getByText(/A −20% EBITDA decline lifts net leverage/)).toBeVisible();
  });

  // [3c] Live issuers use the canonical v2 authority. Establish revision 1 from
  // an explicit sanitized analyst draft; repeated runs may find it saved. The
  // offline engine's CP-1 fixture is deliberately synthetic, so it must never be
  // presented as a server suggestion or relabelled as live source evidence.
  test("a sanitized analyst draft establishes a durable Model Engine v2 revision", async ({ page, request }) => {
    const current = await request.get(`/api/models/v2/${workflowIssuerId}`);
    expect(current.ok()).toBe(true);
    const currentBody = await current.json() as { record: unknown | null };
    if (!currentBody.record) {
      const saveResponse = await request.put(
        `/api/models/v2/${workflowIssuerId}`,
        {
          data: {
            payload: E2E_MODEL_PAYLOAD,
            expected_revision: 0,
            context_id: null,
            source_run_id: null,
          },
        },
      );
      expect(
        saveResponse.ok(),
        `sanitized model save failed: ${saveResponse.status()}`,
      ).toBe(true);
    }
    await page.goto(`/model/?issuer=${encodeURIComponent(workflowIssuerId)}`);
    await expect(page.getByRole("table", { name: "Canonical Model Engine v2 calculation nodes" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/USD · millions · (ready|partial) · rev \d+/i)).toBeVisible();
  });

  // [3c cont.] Queue an input replacement, prove the server preview precedes
  // the atomic commit, then verify the exact node/value survives reload.
  test("a committed Model Engine v2 override survives a reload", async ({ page }) => {
    await page.goto(`/model/?issuer=${encodeURIComponent(workflowIssuerId)}`);
    const table = page.getByRole("table", { name: "Canonical Model Engine v2 calculation nodes" });
    await expect(table).toBeVisible({ timeout: 15000 });

    const edit = page.getByRole("button", { name: /^Edit input:/ }).first();
    await expect(edit).toBeEnabled();
    const nodeId = (await edit.getAttribute("aria-label"))!.replace(/^Edit /, "");
    await edit.click();
    const numeric = page.getByLabel("Numeric value");
    const original = Number(await numeric.inputValue());
    const changed = original >= 9_999_999 ? original - 1 : original + 1;
    await numeric.fill(String(changed));
    await page.getByRole("button", { name: "Queue override" }).click();
    await expect(page.getByText(`${nodeId} queued locally. Preview before committing.`, { exact: true })).toBeVisible();

    const previewOk = page.waitForResponse(
      (response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/models/v2/${workflowIssuerId}/calculate`
        && response.status() === 200,
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Open Model v2 tools" }).click();
    await page
      .getByRole("dialog", { name: "Model v2 tools" })
      .getByRole("button", { name: "Preview pending" })
      .click();
    await previewOk;
    await expect(page.getByText("Server preview refreshed. No mutation has been committed.", { exact: true })).toBeVisible();

    const commitOk = page.waitForResponse(
      (response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/models/v2/${workflowIssuerId}/overrides/batch`
        && response.status() === 200,
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Commit 1 pending" }).click();
    await commitOk;
    await expect(page.getByText("1 pending mutation committed atomically.", { exact: true })).toBeVisible();

    await page.reload();
    await expect(table).toBeVisible({ timeout: 15000 });
    const restored = page.getByRole("row", { name: new RegExp(nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    await expect.poll(async () => Number(
      (await restored.locator("td").nth(1).innerText()).replaceAll(",", ""),
    )).toBe(changed);
    await expect(restored).toContainText("OVERRIDDEN");
  });
});
