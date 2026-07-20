// Production-browser memory lifecycle audit.
//
// Captures the baseline/target/final heap snapshots required by the memory
// debugging workflow after warming the global modal chunks, repeating the
// Command Palette + Ask lifecycles ten times, and forcing a final GC. Compare
// snapshots with the chrome-devtools memory skill's compare_snapshots.js.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:4173";
const ROUTE = process.env.ROUTE || "/settings/";
const CYCLES = Number.parseInt(process.env.CYCLES || "10", 10);
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR
  ? resolve(process.env.SNAPSHOT_DIR)
  : await mkdtemp(join(tmpdir(), "caos-memory-audit-"));
const OUT = resolve(process.env.OUT || `${SNAPSHOT_DIR}/summary.json`);

if (!Number.isInteger(CYCLES) || CYCLES < 1 || CYCLES > 100) {
  throw new Error(`CYCLES must be an integer from 1 to 100; received ${process.env.CYCLES}`);
}

await mkdir(SNAPSHOT_DIR, { recursive: true });

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

async function runtimeMetrics(cdp, collectGarbage = true) {
  if (collectGarbage) await cdp.send("HeapProfiler.collectGarbage");
  const [heap, dom] = await Promise.all([
    cdp.send("Runtime.getHeapUsage"),
    cdp.send("Memory.getDOMCounters"),
  ]);
  return {
    usedHeapMb: round(heap.usedSize / 1024 / 1024),
    totalHeapMb: round(heap.totalSize / 1024 / 1024),
    documents: dom.documents,
    nodes: dom.nodes,
    eventListeners: dom.jsEventListeners,
  };
}

async function takeSnapshot(cdp, name) {
  const chunks = [];
  const onChunk = ({ chunk }) => chunks.push(chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  try {
    await cdp.send("HeapProfiler.takeHeapSnapshot", {
      reportProgress: false,
      captureNumericValue: true,
    });
  } finally {
    cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  }
  const path = resolve(SNAPSHOT_DIR, `${name}.heapsnapshot`);
  await writeFile(path, chunks.join(""), "utf8");
  return path;
}

async function runModalCycle(page) {
  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.waitFor({ state: "visible" });
  await palette.getByRole("combobox").fill("monitor");
  await page.keyboard.press("Escape");
  await palette.waitFor({ state: "hidden" });

  const launcher = page.locator(".caos-ask-launcher");
  await launcher.click();
  const ask = page.getByRole("dialog", { name: "Ask with Query" });
  await ask.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await ask.waitFor({ state: "hidden" });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

const browser = await chromium.launch();
let summary;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installSurfaceStubs(context, {
    id: "memory-local",
    email: "memory@local.dev",
    full_name: "Memory Audit",
    role: "analyst",
    is_active: true,
    source: "local",
  });
  const page = await context.newPage();
  const faults = [];
  page.on("pageerror", (error) => faults.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) faults.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on("console", (message) => {
    // Chromium's generic resource error omits the URL. The response listener
    // above records an actionable status + URL for every HTTP failure.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      faults.push(`console: ${message.text()}`);
    }
  });

  await page.goto(BASE + ROUTE, { waitUntil: "load", timeout: 45_000 });
  await page.locator(".caos-enterprise-page, [data-testid=\"persona-workbench\"]").first().waitFor({ state: "visible", timeout: 20_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.enable");

  // Warm dynamic renderer prefetch and both modal lifecycles so one-time module
  // initialization does not masquerade as cycle growth.
  await runModalCycle(page);
  await page.waitForTimeout(250);
  const baselineMetrics = await runtimeMetrics(cdp);
  const baselineSnapshot = await takeSnapshot(cdp, "baseline");

  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    console.error(`memory: lifecycle ${cycle}/${CYCLES}`);
    await runModalCycle(page);
  }
  const targetMetrics = await runtimeMetrics(cdp, false);
  const targetSnapshot = await takeSnapshot(cdp, "target");

  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(250);
  const finalMetrics = await runtimeMetrics(cdp);
  const finalSnapshot = await takeSnapshot(cdp, "final");

  const heapGrowthMb = round(finalMetrics.usedHeapMb - baselineMetrics.usedHeapMb);
  const nodeGrowth = finalMetrics.nodes - baselineMetrics.nodes;
  const listenerGrowth = finalMetrics.eventListeners - baselineMetrics.eventListeners;
  const thresholds = {
    heapGrowthMb: 2,
    nodeGrowth: 20,
    listenerGrowth: 4,
  };
  summary = {
    base: BASE,
    route: ROUTE,
    cycles: CYCLES,
    generatedAt: new Date().toISOString(),
    metrics: {
      baseline: baselineMetrics,
      target: targetMetrics,
      final: finalMetrics,
      growth: { heapGrowthMb, nodeGrowth, listenerGrowth },
    },
    snapshots: { baseline: baselineSnapshot, target: targetSnapshot, final: finalSnapshot },
    faults,
    thresholds,
    failed:
      faults.length > 0
      || heapGrowthMb > thresholds.heapGrowthMb
      || nodeGrowth > thresholds.nodeGrowth
      || listenerGrowth > thresholds.listenerGrowth,
  };
  await context.close();
} finally {
  await browser.close();
}

await writeFile(OUT, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed ? 1 : 0;
