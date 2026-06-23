import { defineConfig } from "@playwright/test";

// E2E runs against the single-process server (FastAPI serving API + static
// frontend). Start it first: python caos/server/run.py
export default defineConfig({
  testDir: "../tests/frontend/e2e",
  timeout: 30000,
  retries: 1,
  // Log in once (creates the profile cookie); every test reuses it. Avoids the
  // login rate limit that per-test auth would trip under one CI IP.
  globalSetup: "../tests/frontend/e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000",
    storageState: "../tests/frontend/e2e/.auth/state.json",
    trace: "on-first-retry",
  },
});
