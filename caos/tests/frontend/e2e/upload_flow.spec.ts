/**
 * Playwright E2E: core flows against the single-process server.
 *
 * The FastAPI app (caos/server) serves both the API and the static frontend
 * on one port. Build the frontend first (scripts/build_frontend.sh), then run
 * the server: python caos/server/run.py
 *
 * Auth: page tests reuse the signed-in profile from global-setup
 * (storageState). The "identity resolves without login" test opts out with a
 * fresh context to exercise the un-authenticated dev identity.
 */

import { test, expect } from "@playwright/test";

test.describe("CAOS single-process app", () => {
  // Unique per run so repeated runs against a stateful API don't collide.
  const issuerName = `E2E Test Corp ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/issuers/", {
      data: { name: issuerName, ticker: "E2E", industry: "Testing", country: "US" },
    });
    expect(res.ok()).toBeTruthy();
  });

  test("identity resolves without login", async ({ playwright }) => {
    // Explicit empty storageState = no profile cookie, so this hits the dev
    // identity (local-dev, which carries an email) rather than the seeded E2E
    // profile (whose email is "").
    const ctx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000",
      storageState: { cookies: [], origins: [] },
    });
    const res = await ctx.get("/api/auth/me");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).email).toBeTruthy();
    await ctx.dispose();
  });

  test("issuer directory renders with seeded + created issuers", async ({ page }) => {
    await page.goto("/issuers/");
    await expect(page.getByRole("heading", { name: "Issuer Register · coverage universe" })).toBeVisible({
      timeout: 10000,
    });
    await page.getByLabel("Search issuers").fill(issuerName);
    await expect(page.getByText(issuerName, { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test("upload wizard advances to files & run mode step", async ({ page }) => {
    await page.goto("/upload/");
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
    await page.goto("/issuers/");
    await page.getByTitle("Deep-Dive", { exact: true }).click();
    await expect(page).toHaveURL(/\/deepdive/);
    await page.getByTitle("Command", { exact: true }).click();
    await expect(page).toHaveURL(/\/command/);
  });

  test("chat endpoint answers (demo fallback without a key)", async ({ request }) => {
    const res = await request.post("/api/chat/issuer", {
      data: { messages: [{ role: "user", content: "What is net leverage?" }] },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).reply.length).toBeGreaterThan(0);
  });
});
