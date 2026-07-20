// Local axe-core a11y scan over the running dev server. No remote code:
// axe source is injected from node_modules. WCAG 2.0/2.1/2.2 A+AA only.
// Run via `node scripts/a11y-axe.mjs`; registered as a Fallow entry point.
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';
import { summarizeAxeViolations } from './axe-results.mjs';
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE || 'http://localhost:3000';
const edgeSecret = process.env.E2E_EDGE_PROXY_SECRET;
const forwardedEmail = process.env.E2E_FORWARDED_EMAIL || 'e2e-a11y@firm.test';
const analystName = process.env.E2E_ANALYST_NAME || 'A11y Route Matrix';
const screenshotDir = process.env.SCREENSHOT_DIR;
const resultFile = process.env.A11Y_RESULT_FILE;
const quiet = process.env.A11Y_QUIET === '1';
const readySelector = process.env.A11Y_READY_SELECTOR;
const readyTextAbsent = process.env.A11Y_READY_TEXT_ABSENT;
const reducedMotion = process.env.REDUCED_MOTION === '1';
let routes = (process.env.ROUTES || '/,/command,/decisions,/deepdive,/issuers,/issuers/profile?id=iss-1,/model,/monitor,/pipeline,/portfolios,/query,/reports,/research,/sector,/sector-rv,/settings,/sponsors,/upload').split(',');
// Keep structural authoring defects (landmarks, heading order, empty table
// headers, ARIA ownership) in the default gate. WCAG tags alone can report a
// clean matrix while those faults remain in the rendered accessibility tree.
const TAGS = (process.env.AXE_TAGS || 'wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa,best-practice')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean);
const viewports = (process.env.VIEWPORTS || '1440x900').split(',').map((value) => {
  const match = value.trim().match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid VIEWPORTS entry "${value}"; expected WIDTHxHEIGHT`);
  return { width: Number(match[1]), height: Number(match[2]) };
});

const browser = await chromium.launch();
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const page = await browser.newPage({
  viewport: viewports[0],
  // The production CSP intentionally rejects arbitrary inline scripts. Axe is
  // injected from the checked-in dependency only inside this local test
  // browser, so bypass CSP in the harness rather than weakening application
  // policy or maintaining an axe-source hash.
  bypassCSP: true,
  ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === '1',
  ...(edgeSecret ? { extraHTTPHeaders: {
    'X-Edge-Authorization': edgeSecret,
    'X-Forwarded-Email': forwardedEmail,
    'X-Forwarded-User': forwardedEmail,
    'X-Forwarded-Preferred-Username': analystName,
  } } : {}),
});
if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });

// Static-export verification has no API process. When explicitly requested,
// stub identity inside the browser only so axe scans the application surfaces,
// not the authentication recovery wall. Production auth code is unchanged.
if (process.env.BYPASS_AUTH === '1') {
  await installSurfaceStubs(page, { id: 'a11y-local', email: 'a11y@local.dev', full_name: 'A11y Bot', role: 'analyst', is_active: true, source: 'local' });
}

// Sign in first — the app gates every route behind an analyst profile, so without
// this the scan would only ever see the login landing. The POST sets the signed
// cookie in this context's jar, which the page navigations below then carry.
const CODE = process.env.ANALYST_SIGNUP_CODE || '131113';
if (process.env.BYPASS_AUTH !== '1') {
  try {
    const r = await page.request.post(BASE + '/api/auth/profile', { data: { code: CODE, name: analystName } });
    if (!r.ok()) console.error(`a11y login failed (${r.status()}) — scanning the login wall instead`);
  } catch (e) { console.error('a11y login error:', e.message); }

  // Fresh isolated databases do not contain the static-export fixture id. Use
  // the first issuer visible to the authenticated profile so the default
  // profile scan reaches a real workbench instead of timing out on a missing
  // record. An explicit ROUTES value without the placeholder is never changed.
  if (routes.some((route) => route.includes('/issuers/profile?id=iss-1'))) {
    try {
      const response = await page.request.get(BASE + '/api/issuers');
      if (response.ok()) {
        const issuers = await response.json();
        const issuerId = Array.isArray(issuers) && typeof issuers[0]?.id === 'string' ? issuers[0].id : null;
        if (issuerId) {
          routes = routes.map((route) => route.replace('id=iss-1', `id=${encodeURIComponent(issuerId)}`));
        }
      }
    } catch (e) { console.error('a11y issuer resolution error:', e.message); }
  }
}

const out = {};
for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  for (const route of routes) {
  const evidenceKey = `${route}@${viewport.width}x${viewport.height}`;
  if (!quiet) console.error(`axe: ${evidenceKey}`);
  // Long-lived polling and streaming requests mean `networkidle` is not a
  // reliable application-ready signal. DOM readiness plus the shared surface
  // marker below is deterministic and avoids a 30s delay on every live route.
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Most routes use EnterprisePage; standalone workbenches use the shared
  // persona root, while honest empty/error routes may intentionally render a
  // SurfaceState without either shell. All three are explicit ready contracts.
  const surface = page.locator('.caos-enterprise-page, [data-testid="persona-workbench"], [data-surface-state]').first();
  let readinessError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await surface.waitFor({ state: 'visible', timeout: 15000 });
      readinessError = null;
      break;
    } catch (error) {
      readinessError = error;
      // The static root performs a client redirect after auth hydration. On a
      // long route matrix that one transition can occasionally miss the first
      // readiness window even though the destination is healthy. Retry the
      // complete navigation once, then retain the existing fail-closed result.
      if (attempt === 0) {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }
  }
  if (readinessError) {
    out[evidenceKey] = {
      url: new URL(page.url()).pathname,
      viewport,
      scan_error: `Surface readiness marker not found after one retry: ${readinessError.message}`,
      violations: [],
    };
    continue;
  }
  // The static root is a redirector rather than an audited workbench. Its
  // transient shell can satisfy the shared readiness selector immediately
  // before the client navigation destroys the axe/layout execution context.
  // Wait for the destination document explicitly and re-establish readiness so
  // the `/` matrix cell measures the route users actually receive.
  if (new URL(route, BASE).pathname === "/") {
    try {
      await page.waitForURL((url) => url.pathname !== "/", { timeout: 15000 });
      await surface.waitFor({ state: "visible", timeout: 15000 });
    } catch (error) {
      out[evidenceKey] = {
        url: new URL(page.url()).pathname,
        viewport,
        scan_error: `Root redirect did not settle on an auditable surface: ${error.message}`,
        violations: [],
      };
      continue;
    }
  }
  // Some authenticated routes intentionally replace their populated workbench
  // with an honest cold/empty state. The shared shell can already be visible
  // while auth hydration is still settling, so allow focused audits to name a
  // route-specific readiness contract rather than scanning that transient wall.
  if (readyTextAbsent) {
    try {
      await page.waitForFunction(
        (text) => !document.body.textContent?.includes(text),
        readyTextAbsent,
        { timeout: 15000 },
      );
    } catch (error) {
      out[evidenceKey] = {
        url: new URL(page.url()).pathname,
        viewport,
        scan_error: `Transient text "${readyTextAbsent}" did not clear: ${error.message}`,
        violations: [],
      };
      continue;
    }
  }
  if (readySelector) {
    try {
      await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (error) {
      out[evidenceKey] = {
        url: new URL(page.url()).pathname,
        viewport,
        scan_error: `Route readiness selector "${readySelector}" not found: ${error.message}`,
        violations: [],
      };
      continue;
    }
  }
  // The model route resolves a calculation-authority boundary after its shell
  // mounts. Scanning the transient card would miss the actual editor entirely.
  if (new URL(route, BASE).pathname.startsWith('/model')) {
    try {
      await page.waitForFunction(
        () => !document.body.textContent?.includes('Resolving model authority'),
        undefined,
        { timeout: 15000 },
      );
    } catch (error) {
      out[evidenceKey] = {
        url: new URL(page.url()).pathname,
        viewport,
        scan_error: `Model calculation authority did not settle: ${error.message}`,
        violations: [],
      };
      continue;
    }
  }
  // Reference Pipeline lazy-loads its stage graph after the route-level
  // fallback mounts. That fallback intentionally has no enterprise chrome, so
  // scanning it would report the global compact skip link as orphaned and miss
  // the actual dependency map. Wait for the governed workbench, not the loader.
  if (new URL(route, BASE).pathname.startsWith('/pipeline')) {
    try {
      await page.waitForFunction(
        () => !document.body.textContent?.includes('Loading Reference route plan'),
        undefined,
        { timeout: 15000 },
      );
      await page.locator('.caos-enterprise-page').waitFor({ state: 'visible', timeout: 15000 });
    } catch (error) {
      out[evidenceKey] = {
        url: new URL(page.url()).pathname,
        viewport,
        scan_error: `Pipeline reference workbench did not settle: ${error.message}`,
        violations: [],
      };
      continue;
    }
  }
  await page.addScriptTag({ path: axePath });
  const rawViolations = await page.evaluate(async (tags) => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return result.violations;
  }, TAGS);
  const violations = summarizeAxeViolations(rawViolations, { nodeLimit: 4, includeHtml: true });
  const controlLayout = await page.evaluate(() => {
    const rootWidth = document.documentElement.clientWidth;
    const isVisible = (element) => {
      if (element.matches('.sr-only:not(:focus), [hidden]')) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return [style.display !== 'none', style.visibility !== 'hidden', Number(style.opacity) !== 0, rect.width > 0, rect.height > 0, !element.closest('[aria-hidden="true"]')].every(Boolean);
    };
    const hasHorizontalScrollOwner = (element) => {
      let parent = element.parentElement;
      while (parent) {
        if (parent === document.body) return false;
        const style = getComputedStyle(parent);
        if ([/(auto|scroll)/.test(style.overflowX), parent.scrollWidth > parent.clientWidth + 1].every(Boolean)) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const interactive = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="switch"], [tabindex]:not([tabindex="-1"])')]
      .filter(isVisible)
      .filter((element) => !element.matches(':disabled, [aria-disabled="true"]'));
    const describeControl = (element, dimensions = {}) => ({
      tag: element.tagName.toLowerCase(),
      label: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      ...dimensions,
    });
    const clippedControls = interactive
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (rect.left < -1 || rect.right > rootWidth + 1) && !hasHorizontalScrollOwner(element);
      })
      .slice(0, 20)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return describeControl(element, { left: Math.round(rect.left), right: Math.round(rect.right) });
      });
    const targetSizeFailures = interactive
      .filter((element) => getComputedStyle(element).display !== 'inline')
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width >= 24 && rect.height >= 24) return false;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return interactive.some((other) => {
          if (other === element) return false;
          const otherRect = other.getBoundingClientRect();
          const ox = otherRect.left + otherRect.width / 2;
          const oy = otherRect.top + otherRect.height / 2;
          return Math.hypot(cx - ox, cy - oy) < 24;
        });
      })
      .slice(0, 20)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return describeControl(element, { width: Math.round(rect.width), height: Math.round(rect.height) });
      });
    const launcher = document.querySelector('.caos-ask-launcher');
    let overlayCollisions = [];
    if (launcher && isVisible(launcher)) {
      overlayCollisions = interactive.filter((element) => element !== launcher && !launcher.contains(element)).filter((element) => {
        const a = launcher.getBoundingClientRect(); const b = element.getBoundingClientRect();
        const left = Math.max(a.left, b.left); const right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top); const bottom = Math.min(a.bottom, b.bottom);
        if (right - left <= 1 || bottom - top <= 1) return false;
        const painted = document.elementsFromPoint((left + right) / 2, (top + bottom) / 2);
        return painted.some((hit) => hit === element || element.contains(hit));
      }).slice(0, 20).map((element) => describeControl(element));
    }
    return { clipped_controls: clippedControls, target_size_failures: targetSizeFailures, overlay_collisions: overlayCollisions };
  });
  const structuralLayout = await page.evaluate(() => {
    const rootWidth = document.documentElement.clientWidth;
    const pageOverflowPx = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - rootWidth;
    const unexpectedHorizontalOffsets = [...document.querySelectorAll('.caos-enterprise-page, .persona-workbench__composition, .persona-workbench__slot--primary')]
      .filter((element) => element.scrollLeft > 1)
      .map((element) => ({ class_name: typeof element.className === 'string' ? element.className.slice(0, 160) : '', scroll_left: Math.round(element.scrollLeft) }));
    const selectors = ['.caos-enterprise-page', '[data-testid="persona-workbench"]', '.persona-workbench__slot--primary', '.deepdive-analysis-grid', '.deepdive-analysis-primary', '.model-editor-layout', '.model-sheet-region'];
    const diagnosticRegions = selectors.flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return [{ selector, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), client_width: element.clientWidth, scroll_width: element.scrollWidth, overflow_x: style.overflowX }];
    });
    return {
      page_overflow_px: Math.max(0, Math.round(pageOverflowPx)),
      unexpected_horizontal_offsets: unexpectedHorizontalOffsets,
      diagnostic_regions: diagnosticRegions,
    };
  });
  const res = { url: new URL(page.url()).pathname, viewport, layout: { ...structuralLayout, ...controlLayout }, violations };
  out[evidenceKey] = res;
  if (screenshotDir) {
    const safeName = evidenceKey.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
    await page.screenshot({ path: `${screenshotDir}/${safeName}.png`, fullPage: false });
  }
  }
}
await browser.close();
// totals — fail closed when a route was not scanned as well as on violations.
// Otherwise a transient readiness miss can serialize as `scan_error` while the
// validation command still exits 0 and is mistaken for a complete clean matrix.
function hasEntries(value) {
  return Array.isArray(value) && value.length > 0;
}

function layoutHasFailures(layout) {
  if (!layout) return false;
  const counts = [
    (layout.page_overflow_px || 0) > 1,
    hasEntries(layout.clipped_controls),
    hasEntries(layout.target_size_failures),
    hasEntries(layout.overlay_collisions),
    hasEntries(layout.unexpected_horizontal_offsets),
  ];
  return counts.some(Boolean);
}

function routeHasFailures(result) {
  return [Boolean(result.scan_error), hasEntries(result.violations), layoutHasFailures(result.layout)].some(Boolean);
}

let total = 0; let scanErrors = 0; let layoutFailures = 0; const byImpact = {};
for (const r of Object.values(out)) {
  if (r.scan_error) scanErrors += 1;
  if (layoutHasFailures(r.layout)) layoutFailures += 1;
  for (const v of r.violations || []) {
    total += v.n;
    byImpact[v.impact] = (byImpact[v.impact] || 0) + v.n;
  }
}
const compact = process.env.A11Y_COMPACT === '1';
const reportedRoutes = compact
  ? Object.fromEntries(Object.entries(out).filter(([, result]) => routeHasFailures(result)))
  : out;
const summary = { base: BASE, tags: TAGS, viewports, total_nodes: total, scan_errors: scanErrors, layout_failures: layoutFailures, byImpact, routes: reportedRoutes };
if (resultFile) {
  await mkdir(dirname(resultFile), { recursive: true });
  await writeFile(resultFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(summary, null, 2));
process.exit(total > 0 || scanErrors > 0 || layoutFailures > 0 ? 1 : 0);
