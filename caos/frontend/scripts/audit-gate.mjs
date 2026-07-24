// fallow-ignore-file unused-file
//
// Dependency-advisory gate. Replaces a bare `npm audit --audit-level=high`,
// which is all-or-nothing: it cannot express "this specific advisory is
// accepted, for this reason, until this date", so a single unfixable transitive
// advisory takes CI red indefinitely and the usual escape is to drop the gate
// entirely.
//
// This keeps the gate at `high` for everything and allows named exceptions only.
//
// Deliberately dependency-free rather than audit-ci / better-npm-audit: a tool
// that guards the supply chain should not itself enlarge it, and a new npm
// package here would land inside the very surface being audited.
//
// THE ALLOWLIST IS KEYED ON ADVISORY ID, NOT PACKAGE NAME. Allowing an advisory
// does not allow the package — a newly disclosed advisory against the same
// package still fails the gate. Entries also fail once expired, and fail once
// they stop matching anything, so the list ratchets down instead of accreting.
//
// Run:  node scripts/audit-gate.mjs   (from caos/frontend)

import { execFileSync } from "node:child_process";

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const THRESHOLD = SEVERITY_RANK.high;

/**
 * Accepted advisories. Each entry needs an id, an expiry, and a reason that
 * states why the advisory is not reachable — not merely that it is inconvenient.
 * Delete an entry the moment a fixed release exists; do not extend an expiry
 * without redoing the reachability check.
 */
const ALLOWLIST = [
  {
    id: "GHSA-mh99-v99m-4gvg",
    package: "brace-expansion",
    expires: "2026-10-24",
    reason:
      "DoS via unbounded brace expansion. No fixed release is reachable: only " +
      "brace-expansion 5.0.8 is patched, and forcing it via overrides breaks " +
      "eslint outright (minimatch 3.x does require('brace-expansion') expecting " +
      "a function; 5.x changed the export shape -> TypeError: expand is not a " +
      "function). The production path is exceljs -> archiver -> readdir-glob, " +
      "and exceljs 4.4.0 is the latest release with no patched successor. " +
      "Unreachable in CAOS: the globber lives only in archiver's directory() " +
      "and glob() methods, and exceljs calls neither — its writer uses only " +
      "zip.append() and finalize(). components/model/export.ts is write-only " +
      "besides (never Xlsx.load/readFile). The remaining consumers (eslint, " +
      "@vitest/coverage-v8, @typescript-eslint) are devDependencies expanding " +
      "developer-authored config globs, not attacker input. Revisit at expiry: " +
      "eslint 10 and @vitest/coverage-v8 4 clear the dev half via major bumps.",
  },
];

function auditReport() {
  let raw;
  try {
    // `npm audit` exits non-zero whenever it finds anything, so a throw here is
    // the normal path and the stdout on the error is the report we want.
    raw = execFileSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    raw = error.stdout;
    if (!raw) {
      console.error("audit-gate: npm audit produced no output.");
      console.error(error.stderr || error.message);
      process.exit(2);
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error("audit-gate: could not parse npm audit --json output.");
    process.exit(2);
  }
}

function advisoryId(url) {
  const match = /\/(GHSA-[a-z0-9-]+)$/i.exec(url ?? "");
  return match ? match[1] : null;
}

/** Every distinct advisory at or above the threshold, with the packages it hits. */
function findings(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    if ((SEVERITY_RANK[vuln.severity] ?? 0) < THRESHOLD) continue;
    for (const via of vuln.via ?? []) {
      // A string `via` is a transitive hop; only object entries are advisories.
      if (typeof via !== "object") continue;
      if ((SEVERITY_RANK[via.severity] ?? 0) < THRESHOLD) continue;
      const id = advisoryId(via.url);
      if (!id) continue;
      if (!found.has(id)) {
        found.set(id, { id, title: via.title, url: via.url, packages: new Set() });
      }
      found.get(id).packages.add(vuln.name);
    }
  }
  return found;
}

const today = new Date().toISOString().slice(0, 10);
const report = auditReport();
const found = findings(report);
const allowed = new Map(ALLOWLIST.map((entry) => [entry.id, entry]));

const problems = [];

for (const finding of found.values()) {
  const entry = allowed.get(finding.id);
  if (!entry) {
    problems.push(
      `unaccepted ${finding.severity ?? "high"} advisory: ${finding.id} — ${finding.title}\n` +
        `      packages: ${[...finding.packages].sort().join(", ")}\n` +
        `      ${finding.url}\n` +
        `      Fix it, or add a dated exception with a reachability rationale in scripts/audit-gate.mjs.`,
    );
  } else if (entry.expires <= today) {
    problems.push(
      `expired exception: ${finding.id} lapsed on ${entry.expires} (today ${today}).\n` +
        `      Re-check whether a fixed release now exists before extending it.`,
    );
  }
}

// Ratchet: an exception that no longer matches anything must be deleted, so the
// list cannot quietly outlive the advisory it was written for.
for (const entry of ALLOWLIST) {
  if (!found.has(entry.id)) {
    problems.push(
      `stale exception: ${entry.id} (${entry.package}) matches nothing — remove it from scripts/audit-gate.mjs.`,
    );
  }
}

if (problems.length) {
  console.error("Dependency advisory gate failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const accepted = [...found.keys()].filter((id) => allowed.has(id));
console.log(
  `Dependency advisory gate passed: ${found.size} advisory/advisories at >= high, ` +
    `${accepted.length} accepted by dated exception` +
    (accepted.length ? ` (${accepted.join(", ")})` : "") +
    ".",
);
