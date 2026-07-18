import { defineConfig, devices } from "@playwright/test";

const edgeSecret = process.env.E2E_EDGE_PROXY_SECRET;
const storageState = process.env.E2E_STORAGE_STATE_PATH
  || "../tests/frontend/e2e/.auth/state.json";

function projectClientIp(project: string) {
  if (process.env.E2E_CLIENT_IP) return process.env.E2E_CLIENT_IP;
  const suffix = project === "chromium" ? 1 : project === "firefox" ? 2 : project === "webkit" ? 3 : 254;
  return `192.0.2.${suffix}`;
}

function projectStatePath(project: string) {
  const slash = Math.max(storageState.lastIndexOf("/"), storageState.lastIndexOf("\\"));
  const dot = storageState.lastIndexOf(".");
  const extensionAt = dot > slash ? dot : storageState.length;
  return `${storageState.slice(0, extensionAt)}.${project}${storageState.slice(extensionAt) || ".json"}`;
}

function projectIdentity(project: string) {
  return {
    email: process.env.E2E_FORWARDED_EMAIL || `e2e-${project}@firm.test`,
    name: process.env.E2E_ANALYST_NAME || `E2E Analyst ${project}`,
  };
}

function projectUse(project: string, device: (typeof devices)[keyof typeof devices]) {
  const identity = projectIdentity(project);
  const clientIp = projectClientIp(project);
  const requestHeaders = {
    ...(edgeSecret ? {
      "X-Edge-Authorization": edgeSecret,
      "X-Forwarded-Email": identity.email,
      "X-Forwarded-User": identity.email,
      "X-Forwarded-Preferred-Username": identity.name,
    } : {}),
    "X-Forwarded-For": clientIp,
  };
  return {
    ...device,
    storageState: projectStatePath(project),
    ...(Object.keys(requestHeaders).length ? { extraHTTPHeaders: requestHeaders } : {}),
  };
}

// E2E runs against the single-process server (FastAPI serving API + static
// frontend). Start it first: python caos/server/run.py
export default defineConfig({
  testDir: "../tests/frontend/e2e",
  timeout: 30000,
  retries: 1,
  // The default local/QA stack uses one shared SQLite file. Stateful journeys
  // deliberately write the same analyst workspace, and parallel workers can
  // hold SQLite's single writer past its busy timeout. Production concurrency
  // is exercised against PostgreSQL; stateless stress lanes can opt back in
  // with PLAYWRIGHT_WORKERS or the CLI --workers flag.
  workers: process.env.PLAYWRIGHT_WORKERS
    ? Number.parseInt(process.env.PLAYWRIGHT_WORKERS, 10)
    : 1,
  // Log in once (creates the profile cookie); every test reuses it. Avoids the
  // login rate limit that per-test auth would trip under one CI IP.
  globalSetup: "../tests/frontend/e2e/global-setup.ts",
  projects: [
    { name: "chromium", use: projectUse("chromium", devices["Desktop Chrome"]) },
    { name: "firefox", use: projectUse("firefox", devices["Desktop Firefox"]) },
    { name: "webkit", use: projectUse("webkit", devices["Desktop Safari"]) },
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000",
    trace: "on-first-retry",
    ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === "1",
  },
});
