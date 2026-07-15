// Local axe-core a11y scan over the running dev server. No remote code:
// axe source is injected from node_modules. WCAG 2.0/2.1/2.2 A+AA only.
// Run via `node scripts/a11y-axe.mjs`; registered as a Fallow entry point.
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTES = (process.env.ROUTES || '/,/command,/decisions,/deepdive,/issuers,/issuers/profile?id=iss-1,/model,/monitor,/pipeline,/portfolios,/query,/reports,/research,/sector,/sector-rv,/settings,/sponsors,/upload').split(',');
const TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
    const r = await page.request.post(BASE + '/api/auth/profile', { data: { code: CODE, name: 'A11y Bot' } });
    if (!r.ok()) console.error(`a11y login failed (${r.status()}) — scanning the login wall instead`);
  } catch (e) { console.error('a11y login error:', e.message); }
}

const out = {};
for (const route of ROUTES) {
  console.error(`axe: ${route}`);
  // Long-lived polling and streaming requests mean `networkidle` is not a
  // reliable application-ready signal. DOM readiness plus the shared surface
  // marker below is deterministic and avoids a 30s delay on every live route.
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Most routes use EnterprisePage; standalone workbench routes (Portfolio Lab,
  // IC Book, Query, Sector and RV) intentionally own their shell. Wait for the
  // shared persona composition root as the equivalent readiness contract so a
  // single standalone route cannot abort the complete accessibility matrix.
  try {
    await page.locator('.caos-enterprise-page, [data-testid="persona-workbench"]').first().waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    out[route] = {
      url: new URL(page.url()).pathname,
      scan_error: `Surface readiness marker not found: ${error.message}`,
      violations: [],
    };
    continue;
  }
  await page.addScriptTag({ path: axePath });
  const res = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return {
      url: location.pathname,
      violations: r.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help, wcag: v.tags.filter(t=>t.startsWith('wcag')),
        n: v.nodes.length,
        nodes: v.nodes.slice(0,4).map(n => ({ target: n.target, summary: n.failureSummary }))
      }))
    };
  }, TAGS);
  out[route] = res;
}
await browser.close();
// totals — fail closed when a route was not scanned as well as on violations.
// Otherwise a transient readiness miss can serialize as `scan_error` while the
// validation command still exits 0 and is mistaken for a complete clean matrix.
let total = 0; let scanErrors = 0; const byImpact = {};
for (const r of Object.values(out)) {
  if (r.scan_error) scanErrors += 1;
  for (const v of r.violations || []) {
    total += v.n;
    byImpact[v.impact] = (byImpact[v.impact] || 0) + v.n;
  }
}
console.log(JSON.stringify({ base: BASE, tags: TAGS, total_nodes: total, scan_errors: scanErrors, byImpact, routes: out }, null, 2));
process.exit(total > 0 || scanErrors > 0 ? 1 : 0);
