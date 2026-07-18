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
  const state = { cls: 0, lcp: 0, lcpElement: null, shifts: [], longTasks: [], maxEvent: 0 };
  globalThis.__caosPerformance = state;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime < state.lcp) continue;
        state.lcp = entry.startTime;
        state.lcpElement = entry.element ? {
          tag: entry.element.tagName?.toLowerCase() || null,
          id: entry.element.id || null,
          className: typeof entry.element.className === "string" ? entry.element.className.slice(0, 160) : null,
          text: (entry.element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
        } : null;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          state.cls += entry.value;
          state.shifts.push({
            value: entry.value,
            sources: (entry.sources || []).slice(0, 6).map((source) => ({
              tag: source.node?.tagName?.toLowerCase() || null,
              id: source.node?.id || null,
              className: typeof source.node?.className === "string" ? source.node.className.slice(0, 160) : null,
              text: (source.node?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
              previousRect: source.previousRect,
              currentRect: source.currentRect,
            })),
          });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.maxEvent = Math.max(state.maxEvent, entry.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {}
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

function summarize(records) {
  const metrics = ["readyMs", "fcpMs", "lcpMs", "tbtMs", "cls", "encodedKb", "jsKb", "cssKb", "domNodes", "heapMb"];
  return Object.fromEntries(metrics.map((metric) => {
    const values = records.map((record) => Number(record[metric]) || 0);
    const worst = records.reduce((current, record) => (
      (Number(record[metric]) || 0) > (Number(current?.[metric]) || -1) ? record : current
    ), null);
    return [metric, {
      median: round(percentile(values, 0.5), metric === "cls" ? 3 : 1),
      p75: round(percentile(values, 0.75), metric === "cls" ? 3 : 1),
      p95: round(percentile(values, 0.95), metric === "cls" ? 3 : 1),
      worstRoute: worst?.route || null,
    }];
  }));
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
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForTimeout(350);
      } catch (error) {
        scanError = error instanceof Error ? error.message : String(error);
      }
      const readyMs = performance.now() - startedAt;

      const browserMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const paints = Object.fromEntries(
          performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
        );
        const state = globalThis.__caosPerformance || { cls: 0, lcp: 0, longTasks: [], maxEvent: 0 };
        const resourceRows = resources.map((entry) => ({
          name: entry.name,
          encodedBodySize: entry.encodedBodySize || 0,
          transferSize: entry.transferSize || 0,
        }));
        const encoded = resourceRows.reduce((sum, entry) => sum + entry.encodedBodySize, navigation?.encodedBodySize || 0);
        const transferred = resourceRows.reduce((sum, entry) => sum + entry.transferSize, navigation?.transferSize || 0);
        const bytesFor = (extension) => resourceRows
          .filter((entry) => new URL(entry.name).pathname.includes(extension))
          .reduce((sum, entry) => sum + entry.encodedBodySize, 0);
        const longTasks = state.longTasks || [];
        return {
          url: location.pathname,
          ttfbMs: navigation?.responseStart || 0,
          domContentLoadedMs: navigation?.domContentLoadedEventEnd || 0,
          loadMs: navigation?.loadEventEnd || 0,
          fcpMs: paints["first-contentful-paint"] || 0,
          lcpMs: state.lcp || 0,
          lcpElement: state.lcpElement || null,
          cls: state.cls || 0,
          layoutShifts: (state.shifts || []).sort((a, b) => b.value - a.value).slice(0, 5),
          tbtMs: longTasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0),
          longestTaskMs: Math.max(0, ...longTasks),
          maxEventMs: state.maxEvent || 0,
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
