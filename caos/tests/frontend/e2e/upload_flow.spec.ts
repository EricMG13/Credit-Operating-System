/**
 * Playwright E2E: core flows against the single-process server.
 *
 * The FastAPI app (caos/server) serves both the API and the static frontend
 * on one port. Build the frontend first (scripts/build_frontend.sh), then run
 * the server: python caos/server/run.py
 *
 * Auth is platform-managed in deployment; locally /api/auth/me returns a dev
 * identity, so no token seeding is needed.
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000";
const API_URL = process.env.PLAYWRIGHT_API_URL || BASE_URL;

test.describe("CAOS single-process app", () => {
  let issuerId: string;
  // Unique per run so repeated runs against a stateful API don't collide.
  const issuerName = `E2E Test Corp ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_URL}/api/issuers/`, {
      data: { name: issuerName, ticker: "E2E", industry: "Testing", country: "US" },
    });
    expect(res.ok()).toBeTruthy();
    issuerId = (await res.json()).id;
  });

  test("identity resolves without login", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`);
    expect(res.ok()).toBeTruthy();
    const me = await res.json();
    expect(me.email).toBeTruthy();
  });

  test("issuer directory renders with seeded + created issuers", async ({ page }) => {
    await page.goto(`${BASE_URL}/issuers/`);
    await expect(page.getByText("ISSUER REGISTER", { exact: false })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(issuerName)).toBeVisible({ timeout: 10000 });
  });

  test("upload wizard advances to files & run mode step", async ({ page }) => {
    await page.goto(`${BASE_URL}/upload/`);
    await expect(page.getByText("Select issuer", { exact: false })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: new RegExp(issuerName) }).click();
    await expect(page.getByText("Drop all deal documents", { exact: false })).toBeVisible();
    await expect(page.getByText("Full IC Committee", { exact: true })).toBeVisible();
    await expect(page.getByText("Earnings Update", { exact: true })).toBeVisible();
    await expect(page.getByText("Relative Value", { exact: true })).toBeVisible();
    await expect(page.getByText("Legal Review", { exact: true })).toBeVisible();
  });

  test("concept switcher navigates between concepts", async ({ page }) => {
    await page.goto(`${BASE_URL}/issuers/`);
    await page.getByTitle("Deep-Dive", { exact: true }).click();
    await expect(page).toHaveURL(/\/deepdive/);
    await page.getByTitle("Command", { exact: true }).click();
    await expect(page).toHaveURL(/\/command/);
  });

  test("chat endpoint answers (demo fallback without a key)", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/chat/issuer`, {
      data: { messages: [{ role: "user", content: "What is net leverage?" }] },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).reply.length).toBeGreaterThan(0);
  });
});
