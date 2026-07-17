/**
 * Playwright global setup: authenticate ONCE per run and persist the signed
 * profile cookie to one storageState file per browser project. The app gates
 * pages behind a signed-in profile; distinct project principals prevent one
 * engine's durable workspace mutations from changing the next engine's initial
 * state. Three setup logins remain below the 10/min/IP login rate limit.
 */
import { request, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ACCESS_CODE = process.env.E2E_ACCESS_CODE || "131113";
const STATE_PATH = process.env.E2E_STORAGE_STATE_PATH
  || "../tests/frontend/e2e/.auth/state.json"; // relative to cwd (caos/frontend)

function projectStatePath(project: string) {
  const slash = Math.max(STATE_PATH.lastIndexOf("/"), STATE_PATH.lastIndexOf("\\"));
  const dot = STATE_PATH.lastIndexOf(".");
  const extensionAt = dot > slash ? dot : STATE_PATH.length;
  return `${STATE_PATH.slice(0, extensionAt)}.${project}${STATE_PATH.slice(extensionAt) || ".json"}`;
}

function projectIdentity(project: string) {
  return {
    email: process.env.E2E_FORWARDED_EMAIL || `e2e-${project}@firm.test`,
    name: process.env.E2E_ANALYST_NAME || `E2E Analyst ${project}`,
  };
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000";
  const edgeSecret = process.env.E2E_EDGE_PROXY_SECRET;
  const clientIp = process.env.E2E_CLIENT_IP;
  for (const project of config.projects) {
    const identity = projectIdentity(project.name);
    const statePath = projectStatePath(project.name);
    const requestHeaders = {
      ...(edgeSecret ? {
        "X-Edge-Authorization": edgeSecret,
        "X-Forwarded-Email": identity.email,
        "X-Forwarded-User": identity.email,
        "X-Forwarded-Preferred-Username": identity.name,
      } : {}),
      ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
    };
    const ctx = await request.newContext({
      baseURL,
      ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === "1",
      ...(Object.keys(requestHeaders).length ? { extraHTTPHeaders: requestHeaders } : {}),
    });
    const res = await ctx.post("/api/auth/profile", {
      data: { code: ACCESS_CODE, name: identity.name },
    });
    if (!res.ok()) {
      await ctx.dispose();
      throw new Error(`E2E ${project.name} login failed (${res.status()})`);
    }
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    await ctx.storageState({ path: statePath });
    await ctx.dispose();
  }
}
