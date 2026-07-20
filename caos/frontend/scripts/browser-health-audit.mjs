// Rendered route-health audit for the local CAOS application.
//
// This complements axe with browser/runtime checks that axe does not cover:
// console and page exceptions, failed/HTTP-error requests, unresolved loading
// states, document-level metadata, accessible control names, and common LCP
// markup mistakes. It is intentionally read-only apart from creating the local
// analyst session used to reach authenticated surfaces.
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT;
const SETTLE_MS = Number(process.env.SETTLE_MS || 2000);
const analystName = process.env.E2E_ANALYST_NAME || "Browser Health Audit";
const signupCode = process.env.ANALYST_SIGNUP_CODE || "131113";
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
let routes = (process.env.ROUTES || defaultRoutes.join(","))
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

function text(value, limit = 300) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function expectedCompatibilityResponse(value) {
  return /^404 GET .*\/api\/(?:issuers|runs|analysis\/contexts)\/[^\s]+\/freshness(?:\?|$)/.test(value);
}

function resultHasFaults(result) {
  return Boolean(
    result.scanError
    || result.pageErrors.length
    || result.consoleErrors.length
    || result.consoleWarnings.length
    || result.failedRequests.length
    || result.httpErrors.length
    || result.documentFaults.length
    || result.unnamedControls.length
    || result.orphanedInputs.length
    || result.unresolvedStates.length
    || result.lcpMarkupIssues.length
  );
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  const login = await context.request.post(`${BASE}/api/auth/profile`, {
    data: { code: signupCode, name: analystName },
  });
  if (!login.ok()) {
    throw new Error(`Browser audit login failed (${login.status()}): ${text(await login.text())}`);
  }

  if (routes.some((route) => route.includes("/issuers/profile?id=iss-1"))) {
    const response = await context.request.get(`${BASE}/api/issuers`);
    if (!response.ok()) {
      throw new Error(`Issuer resolution failed (${response.status()}): ${text(await response.text())}`);
    }
    const issuers = await response.json();
    const issuerId = Array.isArray(issuers) && typeof issuers[0]?.id === "string"
      ? issuers[0].id
      : null;
    if (!issuerId) throw new Error("Issuer resolution returned no usable issuer id");
    routes = routes.map((route) => route.replace("id=iss-1", `id=${encodeURIComponent(issuerId)}`));
  }

  const results = {};
  for (const route of routes) {
    console.error(`browser-health: ${route}`);
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const consoleWarnings = [];
    const failedRequests = [];
    const httpErrors = [];

    page.on("pageerror", (error) => pageErrors.push(text(errorMessage(error))));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(text(message.text()));
      if (message.type() === "warning") consoleWarnings.push(text(message.text()));
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || "failed"}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    let scanError = null;
    let diagnostics = {
      documentFaults: [], unnamedControls: [], orphanedInputs: [],
      unresolvedStates: [], lcpMarkupIssues: [],
    };
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const surface = page.locator('.caos-enterprise-page, [data-testid="persona-workbench"]').first();
      await surface.waitFor({ state: "visible", timeout: 20_000 });
      if (new URL(route, BASE).pathname.startsWith("/model")) {
        await page.waitForFunction(
          () => !document.body.textContent?.includes("Resolving model authority"),
          undefined,
          { timeout: 15_000 },
        );
      }
      await page.waitForTimeout(SETTLE_MS);

      diagnostics = await page.evaluate(() => {
        const isVisible = (element) => {
          if (element.matches('[hidden], .sr-only:not(:focus)')) return false;
          if (element.closest('[aria-hidden="true"]')) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none"
            && style.visibility !== "hidden"
            && Number(style.opacity) !== 0
            && rect.width > 0
            && rect.height > 0;
        };
        const label = (element) => {
          const labelledBy = (element.getAttribute("aria-labelledby") || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent || "")
            .join(" ");
          const associatedLabels = [...(element.labels || [])]
            .map((item) => item.textContent || "")
            .join(" ");
          return (
            element.getAttribute("aria-label")
            || labelledBy
            || associatedLabels
            || element.getAttribute("title")
            || element.textContent
            || element.getAttribute("alt")
            || ""
          ).trim().replace(/\s+/g, " ").slice(0, 160);
        };

        const documentFaults = [];
        if (!document.documentElement.lang) documentFaults.push("document language is missing");
        if (!document.title) documentFaults.push("document title is missing");
        const viewport = document.querySelector('meta[name="viewport"]')?.content || "";
        if (!viewport) documentFaults.push("viewport metadata is missing");
        if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0+)?(?:,|$)/i.test(viewport)) {
          documentFaults.push(`viewport prevents zoom: ${viewport}`);
        }

        const interactive = [...document.querySelectorAll(
          'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="switch"], [tabindex]:not([tabindex="-1"])',
        )].filter(isVisible).filter((element) => !element.matches(':disabled, [aria-disabled="true"]'));
        const unnamedControls = interactive
          .filter((element) => !label(element) && !element.getAttribute("aria-labelledby"))
          .slice(0, 20)
          .map((element) => element.outerHTML.slice(0, 240));
        const orphanedInputs = [...document.querySelectorAll("input, select, textarea")]
          .filter(isVisible)
          .filter((input) => {
            const explicit = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
            return !explicit
              && !input.closest("label")
              && !input.getAttribute("aria-label")
              && !input.getAttribute("aria-labelledby")
              && !input.getAttribute("title");
          })
          .slice(0, 20)
          .map((input) => input.outerHTML.slice(0, 240));

        const unresolvedPattern = /\b(loading|resolving|checking)\b(?:\.{0,3})?/i;
        const unresolvedStates = [...document.querySelectorAll("body *")]
          .filter(isVisible)
          .filter((element) => element.children.length === 0)
          .map((element) => label(element))
          .filter((value) => unresolvedPattern.test(value))
          .slice(0, 20);

        const lcpMarkupIssues = [];
        const developmentRuntime = Boolean(document.querySelector('script[src*="hmr-client"]'));
        if (!developmentRuntime) {
          for (const image of document.querySelectorAll('img[loading="lazy"]')) {
            const rect = image.getBoundingClientRect();
            if (rect.top < innerHeight && rect.bottom > 0) {
              lcpMarkupIssues.push(`visible image is lazy-loaded: ${image.outerHTML.slice(0, 220)}`);
            }
          }
          for (const image of document.querySelectorAll("img:not([fetchpriority])")) {
            const rect = image.getBoundingClientRect();
            if (rect.top < innerHeight && rect.bottom > 0 && rect.width * rect.height > 50_000) {
              lcpMarkupIssues.push(`large visible image lacks fetchpriority: ${image.outerHTML.slice(0, 220)}`);
            }
          }
          for (const script of document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])')) {
            lcpMarkupIssues.push(`render-blocking script: ${script.outerHTML.slice(0, 220)}`);
          }
        }

        return {
          documentFaults,
          unnamedControls,
          orphanedInputs,
          unresolvedStates,
          lcpMarkupIssues,
        };
      });
    } catch (error) {
      scanError = errorMessage(error);
    }

    const uniqueHttpErrors = unique(httpErrors);
    const unexpectedHttpErrors = uniqueHttpErrors.filter((value) => !expectedCompatibilityResponse(value));
    const expectedCompatibilityOnly = uniqueHttpErrors.length > 0 && unexpectedHttpErrors.length === 0;
    const uniqueConsoleErrors = unique(consoleErrors).filter((value) => !(
      expectedCompatibilityOnly
      && value === "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ));
    results[route] = {
      url: page.url(),
      scanError,
      pageErrors: unique(pageErrors),
      consoleErrors: uniqueConsoleErrors,
      consoleWarnings: unique(consoleWarnings),
      failedRequests: unique(failedRequests),
      httpErrors: unexpectedHttpErrors,
      compatibilityResponses: uniqueHttpErrors.filter(expectedCompatibilityResponse),
      ...diagnostics,
    };
    await page.close();
  }

  const faults = Object.fromEntries(
    Object.entries(results).filter(([, result]) => resultHasFaults(result)),
  );
  const output = {
    base: BASE,
    settleMs: SETTLE_MS,
    routeCount: routes.length,
    faultRouteCount: Object.keys(faults).length,
    routes: faults,
  };
  const json = JSON.stringify(output, null, 2);
  if (OUT) await writeFile(OUT, `${json}\n`, "utf8");
  console.log(json);
  process.exitCode = Object.keys(faults).length > 0 ? 1 : 0;
} finally {
  await context.close();
  await browser.close();
}
