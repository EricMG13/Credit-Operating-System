/**
 * Playwright global setup: authenticate ONCE per run and persist the signed
 * profile cookie to storageState, which every test reuses (see playwright
 * config `use.storageState`). The app gates pages behind a signed-in profile;
 * logging in per-test instead would trip the login rate limit (10/min/IP) under
 * the single CI IP. One login here keeps us well under it.
 */
import { request, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ACCESS_CODE = process.env.E2E_ACCESS_CODE || "131113";
const STATE_PATH = "../tests/frontend/e2e/.auth/state.json"; // relative to cwd (caos/frontend)

export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000";
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/auth/profile", {
    data: { code: ACCESS_CODE, name: "E2E Analyst" },
  });
  if (!res.ok()) throw new Error(`E2E global login failed (${res.status()})`);
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  await ctx.storageState({ path: STATE_PATH });
  await ctx.dispose();
}
