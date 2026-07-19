#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

// import.meta.url is the trusted location of this checked-in runner.
// fallow-ignore-next-line security-sink -- Path is anchored to this checked-in runner's import.meta.url.
const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const staticDir = process.env.E2E_STATIC_DIR
  // E2E_STATIC_DIR is an explicit operator-selected staging location.
  // fallow-ignore-next-line security-sink -- Explicit operator-selected staging path for this local E2E runner.
  ? path.resolve(process.env.E2E_STATIC_DIR)
  // The default is anchored to this runner's repository directory.
  // fallow-ignore-next-line security-sink -- Default path is anchored to this checked-in runner directory.
  : path.resolve(frontendDir, "../server/static");

if (!baseURL) {
  throw new Error("PLAYWRIGHT_BASE_URL is required for the production-like E2E lane.");
}
const target = new URL(baseURL);
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(target.hostname)) {
  throw new Error(`Refusing non-loopback production-like E2E target: ${target.hostname}`);
}
if (!process.env.E2E_EDGE_PROXY_SECRET || !process.env.E2E_ACCESS_CODE) {
  throw new Error("E2E_EDGE_PROXY_SECRET and E2E_ACCESS_CODE are required.");
}

function collectHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    // entry.name comes from readdirSync and cannot contain a path separator.
    // fallow-ignore-next-line security-sink -- readdir entry names cannot contain path separators.
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function latestMtime(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce((latest, entry) => {
    // entry.name comes from readdirSync and cannot contain a path separator.
    // fallow-ignore-next-line security-sink -- readdir entry names cannot contain path separators.
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return Math.max(latest, latestMtime(entryPath));
    // Unit-test edits do not contribute to the exported application artifact.
    // Counting them here makes a current build look stale during an otherwise
    // valid production-like E2E run.
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) return latest;
    return Math.max(latest, statSync(entryPath).mtimeMs);
  }, 0);
}

function expectedInlineScriptHashes(staticDir) {
  const hashes = new Set();
  const inlineScript = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const htmlPath of collectHtmlFiles(staticDir)) {
    const html = readFileSync(htmlPath, "utf8");
    for (const match of html.matchAll(inlineScript)) {
      hashes.add(`'sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}'`);
    }
  }
  return [...hashes].sort();
}

function readLiveCsp(url) {
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      agent: url.protocol === "https:"
        // The target hostname is restricted to loopback above; local test TLS is self-signed.
        // fallow-ignore-next-line security-sink -- TLS verification is disabled only for the loopback-restricted test target.
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined,
      headers: {
        "X-Edge-Authorization": process.env.E2E_EDGE_PROXY_SECRET,
        "X-Forwarded-Email": "e2e-csp-preflight@firm.test",
        "X-Forwarded-User": "e2e-csp-preflight@firm.test",
        "X-Forwarded-Preferred-Username": "E2E CSP Preflight",
      },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve({
        status: response.statusCode,
        csp: response.headers["content-security-policy"] || "",
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function assertStaticExportIsCurrent() {
  // frontendDir is derived from this checked-in runner's import.meta.url.
  // fallow-ignore-next-line security-sink -- Source path is anchored to this checked-in runner's import.meta.url.
  const sourceMtime = latestMtime(path.join(frontendDir, "src"));
  const staticMtime = latestMtime(staticDir);
  if (sourceMtime <= staticMtime) return;
  throw new Error(
    "The staged static export predates the current frontend source. "
    + "Build and stage the frontend, restart the local server, then rerun.",
  );
}

function expectedStaticHashes() {
  const expected = expectedInlineScriptHashes(staticDir);
  if (expected.length > 0) return expected;
  throw new Error("The staged static export contains no hashable inline scripts.");
}

function assertSuccessfulPreflight(status) {
  if (status === 200) return;
  throw new Error(`Production-like CSP preflight returned HTTP ${status}.`);
}

function assertCspContainsHashes(csp, expected) {
  const missing = expected.filter((hash) => !csp.includes(hash));
  if (missing.length === 0) return;
  throw new Error(
    `The live CSP is stale for ${missing.length} inline bootstrap script(s). `
    + "Restart the local server after staging the frontend export, then rerun. "
    + `First missing hash: ${missing[0]}`,
  );
}

async function assertLiveCspMatchesStaticExport() {
  assertStaticExportIsCurrent();
  const expected = expectedStaticHashes();
  const { status, csp } = await readLiveCsp(new URL("/", target));
  assertSuccessfulPreflight(status);
  assertCspContainsHashes(csp, expected);
}

const lanes = [
  {
    email: "e2e-inventory-a@firm.test",
    name: "E2E Inventory A",
    specs: [
      "bootstrap_flow.spec.ts",
      "command_flow.spec.ts",
      "deepdive_flow.spec.ts",
      "login_flow.spec.ts",
      "monitor_flow.spec.ts",
      "query_flow.spec.ts",
    ],
  },
  {
    email: "e2e-inventory-b@firm.test",
    name: "E2E Inventory B",
    specs: [
      "reports_flow.spec.ts",
      "research_flow.spec.ts",
      "research_run.spec.ts",
      "settings_flow.spec.ts",
      "upload_flow.spec.ts",
    ],
  },
  {
    // seed_qa_scale.py --with-workflow-fixture binds the canonical CP-1 run to
    // this explicit fictional analyst so Model Engine v2 ownership stays real.
    email: "e2e-model@firm.test",
    name: "E2E Model Analyst",
    specs: ["model_flow.spec.ts"],
  },
];

const projects = ["chromium", "firefox", "webkit"];

function identityForProject(lane, project) {
  // Inventory journeys mutate the analyst's active context, report defaults,
  // and query session. Give each browser its own principal so a prior project
  // cannot replace state while the next project is hydrating. The Model lane
  // intentionally keeps the one seeded owner bound to its workflow fixture.
  if (lane.email === "e2e-model@firm.test") {
    return { email: lane.email, name: lane.name };
  }
  const [local, domain] = lane.email.split("@");
  return {
    email: `${local}-${project}@${domain}`,
    name: `${lane.name} ${project}`,
  };
}

// frontendDir is derived from this checked-in runner's import.meta.url.
// fallow-ignore-next-line security-sink -- Playwright CLI path is anchored to this checked-in runner directory.
const playwrightCli = path.join(frontendDir, "node_modules", "@playwright", "test", "cli.js");
await assertLiveCspMatchesStaticExport();
for (const [laneIndex, lane] of lanes.entries()) {
  for (const [projectIndex, project] of projects.entries()) {
    const identity = identityForProject(lane, project);
    // The executable, spec names, projects, and flags all come from constants above.
    // fallow-ignore-next-line security-sink -- Executable, specs, projects, and flags are checked-in constants.
    const result = spawnSync(
      process.execPath,
      [playwrightCli, "test", ...lane.specs, `--project=${project}`, "--retries=0"],
      {
        cwd: frontendDir,
        env: {
          ...process.env,
          // frontendDir is derived from this checked-in runner's import.meta.url.
          // fallow-ignore-next-line security-sink -- NODE_PATH is anchored to the runner's fixed node_modules directory.
          NODE_PATH: path.join(frontendDir, "node_modules"),
          E2E_FORWARDED_EMAIL: identity.email,
          E2E_ANALYST_NAME: identity.name,
          // RFC 5737 documentation addresses isolate the real per-source
          // throttle while the shared 30/minute credential backstop remains.
          E2E_CLIENT_IP: `192.0.2.${laneIndex * projects.length + projectIndex + 1}`,
          // The lane identity and project are fixed constants declared above.
          // fallow-ignore-next-line security-sink -- State path combines fixed lane and browser-project constants.
          E2E_STORAGE_STATE_PATH: path.join(
            frontendDir,
            "../tests/frontend/e2e/.auth",
            `state-${lane.email.split("@")[0]}-${project}.json`,
          ),
        },
        stdio: "inherit",
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
