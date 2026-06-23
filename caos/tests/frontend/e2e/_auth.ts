/**
 * E2E auth helper. The app gates every page behind a signed-in analyst profile
 * (code-gated login → signed cookie). Page specs must authenticate before
 * navigating, or RequireAuth shows the sign-in landing instead of the app.
 *
 * page.request shares the browser context's cookie jar, so the Set-Cookie from
 * the login lands on subsequent page.goto navigations in the same test.
 *
 * Not a *.spec/*.test file, so Playwright won't collect it as a test.
 */
import { expect, type Page } from "@playwright/test";

const ACCESS_CODE = process.env.E2E_ACCESS_CODE || "131113";

export async function loginAsAnalyst(page: Page, name = "E2E Analyst") {
  const res = await page.request.post("/api/auth/profile", {
    data: { code: ACCESS_CODE, name },
  });
  expect(res.ok(), `login failed (${res.status()})`).toBeTruthy();
}
