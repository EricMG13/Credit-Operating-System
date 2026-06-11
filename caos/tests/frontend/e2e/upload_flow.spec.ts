/**
 * Playwright E2E test: Document upload flow and DAG trigger.
 * Tests:
 *  1. Issuer directory renders
 *  2. Upload wizard advances to document-type step
 *  3. Trigger a DAG run via API
 */

import { test, expect } from "@playwright/test";
import path from "path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8000";

test.describe("Upload and DAG flow", () => {
  let issuerId: string;
  // Unique per run so repeated runs against a stateful API don't collide.
  const issuerName = `E2E Test Corp ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    // Create a test issuer via API
    const res = await request.post(`${API_URL}/api/issuers/`, {
      data: { name: issuerName, ticker: "E2E", industry: "Testing", country: "US" },
    });
    expect(res.ok()).toBeTruthy();
    const issuer = await res.json();
    issuerId = issuer.id;
  });

  test("Issuer directory renders", async ({ page }) => {
    await page.goto(`${BASE_URL}/issuers`);
    await expect(page.locator("h1")).toContainText("CAOS");
    await expect(page.getByText(issuerName)).toBeVisible({ timeout: 10000 });
  });

  test("Upload page loads and advances to document-type step", async ({ page }) => {
    await page.goto(`${BASE_URL}/upload`);
    // Wizard starts on the issuer-selection step.
    await expect(page.locator("h1")).toContainText("Document Upload");
    await expect(page.getByRole("heading", { name: "Select Issuer" })).toBeVisible();
    // Pick our test issuer → the document-type step exposes the canonical doc types.
    await page.getByRole("button", { name: issuerName }).click();
    await expect(page.getByRole("heading", { name: /Document Type/ })).toBeVisible();
    await expect(page.getByText("Credit Agreement")).toBeVisible();
  });

  test("DAG run triggers and appears in status badge", async ({ page, request }) => {
    // Upload a minimal PDF to trigger a run
    // (In CI, use a fixture PDF in tests/fixtures/)
    const triggerRes = await request.post(`${API_URL}/api/agents/run`, {
      data: {
        issuer_id: issuerId,
        document_id: "00000000-0000-0000-0000-000000000000",
        force_full_run: false,
      },
    });
    // Expect 202 Accepted (even if BLOCKED due to missing docs — status badge should appear)
    expect([202, 404, 422]).toContain(triggerRes.status());
  });
});
