// Local axe-core a11y scan over the running dev server. No remote code:
// axe source is injected from node_modules. WCAG 2.0/2.1/2.2 A+AA only.
// Run via `node scripts/a11y-axe.mjs`; registered as a Fallow entry point.
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE || 'http://localhost:3000';
const edgeSecret = process.env.E2E_EDGE_PROXY_SECRET;
const forwardedEmail = process.env.E2E_FORWARDED_EMAIL || 'e2e-a11y@firm.test';
const analystName = process.env.E2E_ANALYST_NAME || 'A11y Route Matrix';
let routes = (process.env.ROUTES || '/,/command,/decisions,/deepdive,/issuers,/issuers/profile?id=iss-1,/model,/monitor,/pipeline,/portfolios,/query,/reports,/research,/sector,/sector-rv,/settings,/sponsors,/upload').split(',');
const TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
const viewports = (process.env.VIEWPORTS || '1440x900').split(',').map((value) => {
  const match = value.trim().match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid VIEWPORTS entry "${value}"; expected WIDTHxHEIGHT`);
  return { width: Number(match[1]), height: Number(match[2]) };
});

const browser = await chromium.launch();
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
  console.error(`axe: ${evidenceKey}`);
  // Long-lived polling and streaming requests mean `networkidle` is not a
  // reliable application-ready signal. DOM readiness plus the shared surface
  // marker below is deterministic and avoids a 30s delay on every live route.
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Most routes use EnterprisePage; standalone workbench routes (Portfolio Lab,
  // IC Book, Query, Sector and RV) intentionally own their shell. Wait for the
  // shared persona composition root as the equivalent readiness contract so a
  // single standalone route cannot abort the complete accessibility matrix.
  const surface = page.locator('.caos-enterprise-page, [data-testid="persona-workbench"]').first();
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
  await page.addScriptTag({ path: axePath });
  const res = await page.evaluate(async ({ tags, viewport }) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    const rootWidth = document.documentElement.clientWidth;
    const pageOverflowPx = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - rootWidth;
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0 && !element.closest('[aria-hidden="true"]');
    };
    const hasHorizontalScrollOwner = (element) => {
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
      }
      return false;
    };
    const clippedControls = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')]
      .filter(isVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (rect.left < -1 || rect.right > rootWidth + 1) && !hasHorizontalScrollOwner(element);
      })
      .slice(0, 20)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          label: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      });
    return {
      url: location.pathname,
      viewport,
      layout: { page_overflow_px: Math.max(0, Math.round(pageOverflowPx)), clipped_controls: clippedControls },
      violations: r.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help, wcag: v.tags.filter(t=>t.startsWith('wcag')),
        n: v.nodes.length,
        nodes: v.nodes.slice(0,4).map(n => ({ target: n.target, summary: n.failureSummary }))
      }))
    };
  }, { tags: TAGS, viewport });
  out[evidenceKey] = res;
  }
}
await browser.close();
// totals — fail closed when a route was not scanned as well as on violations.
// Otherwise a transient readiness miss can serialize as `scan_error` while the
// validation command still exits 0 and is mistaken for a complete clean matrix.
let total = 0; let scanErrors = 0; let layoutFailures = 0; const byImpact = {};
for (const r of Object.values(out)) {
  if (r.scan_error) scanErrors += 1;
  if ((r.layout?.page_overflow_px || 0) > 1 || (r.layout?.clipped_controls?.length || 0) > 0) layoutFailures += 1;
  for (const v of r.violations || []) {
    total += v.n;
    byImpact[v.impact] = (byImpact[v.impact] || 0) + v.n;
  }
}
console.log(JSON.stringify({ base: BASE, tags: TAGS, viewports, total_nodes: total, scan_errors: scanErrors, layout_failures: layoutFailures, byImpact, routes: out }, null, 2));
process.exit(total > 0 || scanErrors > 0 || layoutFailures > 0 ? 1 : 0);
