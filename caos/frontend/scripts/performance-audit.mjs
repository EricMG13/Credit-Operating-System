// Route-level frontend performance lab for the production static export.
// Measures cold-cache desktop and constrained-mobile loads with the same local
// API fixtures used by the accessibility/layout gates. It does not mutate app
// state or require a live backend.
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:4173";
const OUT = process.env.OUT;
const defaultRoutes = [
  "/",
  "/command",
  "/decisions",
  "/deepdive",
  "/issuers",
  "/issuers/profile?id=iss-1",
  "/model",
  "/monitor",
  "/pipeline",
  "/portfolios",
  "/query",
  "/reports",
  "/research",
  "/sector",
  "/sector-rv",
  "/settings",
  "/sponsors",
  "/upload",
];
const routes = (process.env.ROUTES || defaultRoutes.join(","))
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const allProfiles = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    cpuRate: 1,
    network: null,
  },
  {
    name: "mobile-slow",
    viewport: { width: 390, height: 844 },
    cpuRate: 4,
    network: {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: "cellular3g",
    },
  },
];
const requestedProfiles = process.env.PROFILES
  ? new Set(process.env.PROFILES.split(",").map((profile) => profile.trim()))
  : null;
const profiles = requestedProfiles
  ? allProfiles.filter((profile) => requestedProfiles.has(profile.name))
  : allProfiles;

if (profiles.length === 0) throw new Error("No matching performance profiles selected");

const observerSource = () => {
  const state = { cls: 0, lcp: 0, lcpElement: null, shifts: [], longTasks: [], longTaskDetails: [], maxEvent: 0 };
  globalThis.__caosPerformance = state;
  const text = (value, limit) => String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
  const className = (node) => typeof node?.className === "string" ? node.className.slice(0, 160) : null;
  const lcpElement = (element) => element ? { tag: element.tagName.toLowerCase(), id: element.id || null, className: className(element), text: text(element.textContent, 160) } : null;
  const shiftSource = (source) => {
    const node = source.node;
    if (!node) return { tag: null, id: null, className: null, text: "", previousRect: source.previousRect, currentRect: source.currentRect };
    const tag = typeof node.tagName === "string"
      ? node.tagName.toLowerCase()
      : typeof node.nodeName === "string" ? node.nodeName.toLowerCase() : null;
    return { tag, id: node.id || null, className: className(node), text: text(node.textContent, 120), previousRect: source.previousRect, currentRect: source.currentRect };
  };
  const observe = (options, handle) => {
    try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) handle(entry); }).observe(options); } catch {}
  };
  const recordLcp = (entry) => {
    if (entry.startTime < state.lcp) return;
    state.lcp = entry.startTime;
    state.lcpElement = lcpElement(entry.element);
  };
  const recordShift = (entry) => {
    if (entry.hadRecentInput) return;
    const value = Number(entry.value) || 0;
    state.cls += value;
    let sources = [];
    try { sources = Array.from(entry.sources || []).slice(0, 6).map(shiftSource); } catch {}
    state.shifts.push({ value, sources });
  };
  observe({ type: "largest-contentful-paint", buffered: true }, recordLcp);
  observe({ type: "layout-shift", buffered: true }, recordShift);
  observe({ type: "longtask", buffered: true }, (entry) => {
    state.longTasks.push(entry.duration);
    state.longTaskDetails.push({
      startTime: entry.startTime,
      duration: entry.duration,
      attribution: Array.from(entry.attribution || []).map((item) => ({
        name: item.name,
        entryType: item.entryType,
        containerType: item.containerType,
        containerName: item.containerName,
        containerId: item.containerId,
        containerSrc: item.containerSrc,
      })),
    });
  });
  observe({ type: "event", buffered: true, durationThreshold: 16 }, (entry) => { state.maxEvent = Math.max(state.maxEvent, entry.duration); });
};

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function numericMetric(record, metric) {
  return Number(record?.[metric]) || 0;
}

function worstMetricRecord(records, metric) {
  let worst = null;
  let maximum = -1;
  for (const record of records) {
    const value = numericMetric(record, metric);
    if (value > maximum) { maximum = value; worst = record; }
  }
  return worst;
}

function summarizeMetric(records, metric) {
  const values = records.map((record) => numericMetric(record, metric));
  const worst = worstMetricRecord(records, metric);
  const digits = metric === "cls" ? 3 : 1;
  return { median: round(percentile(values, 0.5), digits), p75: round(percentile(values, 0.75), digits), p95: round(percentile(values, 0.95), digits), worstRoute: worst?.route || null };
}

function summarize(records) {
  const metrics = ["readyMs", "fcpMs", "lcpMs", "tbtMs", "cls", "encodedKb", "jsKb", "cssKb", "domNodes", "heapMb"];
  return Object.fromEntries(metrics.map((metric) => [metric, summarizeMetric(records, metric)]));
}

const browser = await chromium.launch();
const records = [];
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport });
    await context.addInitScript(observerSource);
    await installSurfaceStubs(context, {
      id: "performance-local",
      email: "performance@local.dev",
      full_name: "Performance Bot",
      role: "analyst",
      is_active: true,
      source: "local",
    });

    for (const route of routes) {
      console.error(`performance: ${profile.name} ${route}`);
      const page = await context.newPage();
      const staticAssetTransport = [];
      page.on("response", (response) => {
        try {
          const pathname = new URL(response.url()).pathname;
          if (!pathname.startsWith("/_next/static/") || !/\.(?:css|js)$/.test(pathname)) return;
          staticAssetTransport.push({
            pathname,
            encoding: (response.headers()["content-encoding"] || "identity").toLowerCase(),
          });
        } catch {}
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuRate });
      if (profile.network) await cdp.send("Network.emulateNetworkConditions", profile.network);

      const startedAt = performance.now();
      let scanError = null;
      try {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => undefined);
        const surface = page.locator(".caos-enterprise-page, [data-testid=\"persona-workbench\"]").first();
        await surface.waitFor({ state: "visible", timeout: 20_000 });
        if (new URL(route, BASE).pathname === "/model") {
          await page.getByLabel("Model worksheet").waitFor({ state: "visible", timeout: 20_000 });
        }
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForTimeout(350);
      } catch (error) {
        scanError = error instanceof Error ? error.message : String(error);
      }
      const uncompressedStaticAssets = staticAssetTransport
        .filter((asset) => !/^(?:br|gzip|zstd)$/.test(asset.encoding))
        .map((asset) => asset.pathname);
      if (!scanError && uncompressedStaticAssets.length > 0 && process.env.ALLOW_UNCOMPRESSED !== "1") {
        scanError = `${uncompressedStaticAssets.length} static JS/CSS assets used identity transport; run npm run serve:performance before accepting payload or timing evidence`;
      }
      const readyMs = performance.now() - startedAt;

      const browserMetrics = await page.evaluate(() => {
        const numeric = (value) => Number(value) || 0;
        const fallback = (value, defaultValue) => value ?? defaultValue;
        const navigation = fallback(performance.getEntriesByType("navigation")[0], {});
        const resources = performance.getEntriesByType("resource");
        const paints = Object.fromEntries(
          performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
        );
        const state = fallback(globalThis.__caosPerformance, { cls: 0, lcp: 0, longTasks: [], longTaskDetails: [], maxEvent: 0 });
        const resourceRows = resources.map((entry) => ({
          name: entry.name,
          encodedBodySize: numeric(entry.encodedBodySize),
          transferSize: numeric(entry.transferSize),
        }));
        const encoded = resourceRows.reduce((sum, entry) => sum + entry.encodedBodySize, numeric(navigation.encodedBodySize));
        const transferred = resourceRows.reduce((sum, entry) => sum + entry.transferSize, numeric(navigation.transferSize));
        const bytesFor = (extension) => resourceRows
          .filter((entry) => new URL(entry.name).pathname.includes(extension))
          .reduce((sum, entry) => sum + entry.encodedBodySize, 0);
        const longTasks = Array.from(fallback(state.longTasks, []));
        return {
          url: location.pathname,
          ttfbMs: numeric(navigation.responseStart),
          domContentLoadedMs: numeric(navigation.domContentLoadedEventEnd),
          loadMs: numeric(navigation.loadEventEnd),
          fcpMs: numeric(paints["first-contentful-paint"]),
          lcpMs: numeric(state.lcp),
          lcpElement: fallback(state.lcpElement, null),
          cls: numeric(state.cls),
          layoutShifts: fallback(state.shifts, []).sort((a, b) => b.value - a.value).slice(0, 5),
          tbtMs: longTasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0),
          longestTaskMs: Math.max(0, ...longTasks),
          longTaskDetails: fallback(state.longTaskDetails, []),
          maxEventMs: numeric(state.maxEvent),
          requests: resources.length + 1,
          encodedKb: encoded / 1024,
          transferredKb: transferred / 1024,
          jsKb: bytesFor(".js") / 1024,
          cssKb: bytesFor(".css") / 1024,
          domNodes: document.getElementsByTagName("*").length,
        };
      }).catch(() => ({
        url: new URL(page.url()).pathname,
        ttfbMs: 0,
        domContentLoadedMs: 0,
        loadMs: 0,
        fcpMs: 0,
        lcpMs: 0,
        lcpElement: null,
        cls: 0,
        layoutShifts: [],
        tbtMs: 0,
        longestTaskMs: 0,
        maxEventMs: 0,
        requests: 0,
        encodedKb: 0,
        transferredKb: 0,
        jsKb: 0,
        cssKb: 0,
        domNodes: 0,
      }));
      const cdpMetrics = await cdp.send("Performance.getMetrics");
      const cdpMap = Object.fromEntries(cdpMetrics.metrics.map(({ name, value }) => [name, value]));
      records.push({
        profile: profile.name,
        route,
        scanError,
        contentEncodings: [...new Set(staticAssetTransport.map((asset) => asset.encoding))].sort(),
        uncompressedStaticAssets,
        readyMs: round(readyMs),
        ...Object.fromEntries(Object.entries(browserMetrics).map(([key, value]) => [key, typeof value === "number" ? round(value, key === "cls" ? 3 : 1) : value])),
        heapMb: round((cdpMap.JSHeapUsedSize || 0) / 1024 / 1024),
        taskDurationMs: round((cdpMap.TaskDuration || 0) * 1000),
        scriptDurationMs: round((cdpMap.ScriptDuration || 0) * 1000),
        layoutDurationMs: round((cdpMap.LayoutDuration || 0) * 1000),
        recalcStyleDurationMs: round((cdpMap.RecalcStyleDuration || 0) * 1000),
      });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const result = {
  base: BASE,
  generatedAt: new Date().toISOString(),
  profiles: Object.fromEntries(profiles.map((profile) => {
    const profileRecords = records.filter((record) => record.profile === profile.name);
    return [profile.name, {
      viewport: profile.viewport,
      cpuRate: profile.cpuRate,
      network: profile.network,
      scanErrors: profileRecords.filter((record) => record.scanError).length,
      summary: summarize(profileRecords),
    }];
  })),
  records,
};
const json = JSON.stringify(result, null, 2);
if (OUT) await writeFile(OUT, json + "\n", "utf8");
console.log(json);
process.exitCode = records.some((record) => record.scanError) ? 1 : 0;
