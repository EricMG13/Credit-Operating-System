// Local axe-core a11y scan over the running dev server. No remote code:
// axe source is injected from node_modules. WCAG 2.0/2.1/2.2 A+AA only.
// ponytail: one-off audit script, deleted-or-kept at user's call.
// fallow-ignore-file unused-file
// (run via `node scripts/a11y-axe.mjs`, not imported — invisible to the import graph.)
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTES = (process.env.ROUTES || '/,/command,/issuers,/deepdive,/pipeline,/model,/reports,/research,/upload,/settings,/query,/monitor').split(',');
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
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
  } catch { await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
  await page.locator('.caos-enterprise-page').waitFor({ state: 'visible' });
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
// totals
let total = 0; const byImpact = {};
for (const r of Object.values(out)) for (const v of r.violations) { total += v.n; byImpact[v.impact]=(byImpact[v.impact]||0)+v.n; }
console.log(JSON.stringify({ base: BASE, tags: TAGS, total_nodes: total, byImpact, routes: out }, null, 2));
