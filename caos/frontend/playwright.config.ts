import { defineConfig } from "@playwright/test";

// E2E runs against the single-process server (FastAPI serving API + static
// frontend). Start it first: python caos/server/run.py
export default defineConfig({
  testDir: "../tests/frontend/e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000",
    trace: "on-first-retry",
  },
});
