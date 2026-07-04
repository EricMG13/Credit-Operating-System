/**
 * Playwright E2E: the login UI (LoginLanding), journey 7 gap E2E-7b.
 *
 * global-setup authenticates via the API (POST /api/auth/profile) so the other
 * specs start pre-authed and never render the form. This spec drives the REAL
 * LoginLanding walk instead: register a fresh account, and the two error paths.
 *
 * Dev-stack caveat: on the single-process dev server an unauthenticated
 * /api/auth/me resolves to the "local" dev identity, which AuthProvider treats
 * as signed-in (needsLogin=false) — so the form never shows. We stub /me → 401
 * to defeat that dev auto-identity and surface the form; every auth mutation
 * (register/login) hits the real backend un-stubbed. For the happy path we wait
 * for the real 201, drop the stub, and reload so the real /me (now carrying the
 * register cookie) renders the app.
 */

import { test, expect } from "@playwright/test";

// Fresh context — no profile cookie from global-setup's storageState.
test.use({ storageState: { cookies: [], origins: [] } });

const unauthMe = { status: 401, contentType: "application/json", body: JSON.stringify({ detail: "no identity" }) };

// The login error is a <p id="login-error" role="alert">; scope to the id so we
// don't collide with Next's empty route-announcer (also role="alert").
const loginError = "#login-error";

async function fillSignup(page: import("@playwright/test").Page, code: string) {
  // Unique per run: the display name AND email are both unique-constrained.
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.getByRole("tab", { name: "Create" }).click();
  await page.getByLabel("Analyst name").fill(`E2E Login ${stamp}`);
  await page.getByLabel("Email").fill(`e2e-login-${stamp}@firm.test`);
  await page.getByLabel("Login passcode").fill("testpass123");
  await page.getByLabel("Confirm passcode").fill("testpass123");
  await page.getByLabel("Invite code").fill(code);
  await page.getByLabel("Recovery word 1").fill("alpha");
  await page.getByLabel("Recovery word 2").fill("bravo");
  await page.getByLabel("Recovery word 3").fill("charlie");
}

test.describe("Login (LoginLanding)", () => {
  test("register creates an account and lands in the app", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill(unauthMe));

    await page.goto("/issuers/");
    await fillSignup(page, process.env.E2E_ACCESS_CODE || "131113");

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/register") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
    expect(resp.status()).toBe(201);

    // Drop the stub and reload — the real /me now carries the register cookie
    // and resolves source:"profile" → past the RequireAuth gate.
    await page.unroute("**/api/auth/me");
    await page.reload();
    await expect(page.getByRole("heading", { name: /Issuer Register/i })).toBeVisible({ timeout: 15000 });
  });

  test("wrong invite code surfaces the error, stays on the form", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill(unauthMe));

    await page.goto("/issuers/");
    await fillSignup(page, "000000");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.locator(loginError)).toContainText(/invite code/i);
    await expect(page.getByRole("tab", { name: "Create" })).toBeVisible(); // still on the form
  });

  test("sign-in with wrong passcode surfaces an error", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill(unauthMe));

    await page.goto("/issuers/");
    // signin is the default tab.
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@firm.test`);
    await page.getByLabel("Login passcode").fill("wrongpasscode");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator(loginError)).toBeVisible({ timeout: 10000 });
  });
});
