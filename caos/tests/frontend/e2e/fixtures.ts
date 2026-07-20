import fs from "node:fs";
import path from "node:path";
import {
  expect,
  test as base,
  type APIRequestContext,
} from "@playwright/test";

interface StoredCookie {
  name: string;
  value: string;
}

interface StoredState {
  cookies: StoredCookie[];
}

function storageStatePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export const test = base.extend<{ request: APIRequestContext }>({
  request: async ({ playwright }, use, testInfo) => {
    const configuredState = testInfo.project.use.storageState;
    if (typeof configuredState !== "string") {
      throw new Error("Authenticated E2E API requests require a file-backed storageState.");
    }

    const statePath = storageStatePath(configuredState);
    const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as StoredState;
    const csrfToken = state.cookies.find((cookie) => cookie.name === "caos_csrf")?.value;
    if (!csrfToken) {
      throw new Error(`Authenticated E2E storageState has no caos_csrf cookie: ${statePath}`);
    }

    const baseURL = typeof testInfo.project.use.baseURL === "string"
      ? testInfo.project.use.baseURL
      : process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000";
    const headers = {
      ...(testInfo.project.use.extraHTTPHeaders ?? {}),
      Origin: new URL(baseURL).origin,
      "X-CSRF-Token": csrfToken,
    };
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: headers,
      ignoreHTTPSErrors: testInfo.project.use.ignoreHTTPSErrors,
      storageState: statePath,
    });
    await use(context);
    await context.dispose();
  },
});

export { expect };
