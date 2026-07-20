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
test.use({ storageState: { cookies: [], origins: [] }, bypassCSP: true });

const axePath = require.resolve("axe-core/axe.min.js");

const unauthMe = { status: 401, contentType: "application/json", body: JSON.stringify({ detail: "no identity" }) };

// The login error is a <p id="login-error" role="alert">; scope to the id so we
// don't collide with Next's empty route-announcer (also role="alert").
const loginError = "#login-error";

async function fillSignup(page: import("@playwright/test").Page, code: string) {
  // Unique per run: the display name AND email are both unique-constrained.
  const stamp = `${Date.now()}-${crypto.randomUUID()}`;
  await page.getByRole("tab", { name: "Create" }).click();
  await page.getByLabel("Analyst name").fill(`E2E Login ${stamp}`);
  const email = `e2e-login-${stamp}@firm.test`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Login passcode").fill("testpass1234");
  await page.getByLabel("Confirm passcode").fill("testpass1234");
  await page.getByLabel("Invite code").fill(code);
  await page.getByLabel("Recovery word 1").fill("alpha");
  await page.getByLabel("Confirm word 1").fill("alpha");
  await page.getByLabel("Recovery word 2").fill("bravo");
  await page.getByLabel("Confirm word 2").fill("bravo");
  await page.getByLabel("Recovery word 3").fill("charlie");
  await page.getByLabel("Confirm word 3").fill("charlie");
  return email;
}

test.describe("Login (LoginLanding)", () => {
  test("register creates an account and lands in the app", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill(unauthMe));

    await page.goto("/issuers/");
    const email = await fillSignup(page, process.env.E2E_ACCESS_CODE || "131113");
    if (process.env.E2E_EDGE_PROXY_SECRET) {
      await page.setExtraHTTPHeaders({
        "X-Edge-Authorization": process.env.E2E_EDGE_PROXY_SECRET,
        "X-Forwarded-Email": email,
        "X-Forwarded-User": email,
        "X-Forwarded-Preferred-Username": `E2E Login ${email}`,
      });
    }

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

  test("auth login mobile responsive states remain accessible and unclipped", async ({ page }) => {
    const featureIds = ["auth-01", "auth-10", "auth-16", "auth-17", "auth-18"];
    expect(featureIds).toHaveLength(5); // Stable tracker evidence tags for this state matrix.

    await page.route("**/api/auth/me", (route) => route.fulfill(unauthMe));
    await page.route("**/api/auth/login", (route) => route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Invalid email or passcode." }),
    }));

    const assertCurrentState = async () => {
      const layout = await page.evaluate(() => {
        const rootWidth = document.documentElement.clientWidth;
        // fallow-ignore-next-line complexity -- Browser-evaluated layout probes cannot appear in Vitest Istanbul coverage.
        const visible = (element: Element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden"
            && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
        };
        const clippedControls = [...document.querySelectorAll(
          'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
        )]
          .filter(visible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > rootWidth + 1;
          })
          .map((element) => (element.getAttribute("aria-label") || element.textContent || element.tagName).trim());
        return {
          pageOverflowPx: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - rootWidth,
          clippedControls,
        };
      });
      expect(layout.pageOverflowPx).toBeLessThanOrEqual(1);
      expect(layout.clippedControls).toEqual([]);

      const violations = await page.evaluate(async () => {
        const axe = (window as typeof window & {
          axe: { run: (root: Document, options: unknown) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> };
        }).axe;
        const result = await axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        });
        return result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.length }));
      });
      expect(violations).toEqual([]);
    };

    for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/issuers/");
      await page.addScriptTag({ path: axePath });

      for (const mode of ["Sign in", "Create", "Recover"] as const) {
        await page.getByRole("tab", { name: mode, exact: true }).click();
        await expect(page.getByRole("tab", { name: mode, exact: true })).toHaveAttribute("aria-selected", "true");
        await assertCurrentState();
      }

      await page.getByRole("tab", { name: "Sign in", exact: true }).click();
      await page.getByLabel("Email").fill("responsive-login@firm.test");
      await page.getByLabel("Login passcode").fill("wrongpasscode");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.locator(loginError)).toContainText("Invalid email or passcode.");
      await assertCurrentState();
    }
  });
});
