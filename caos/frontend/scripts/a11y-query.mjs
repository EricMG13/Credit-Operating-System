// axe-core scan of the Query concept's interactive states — the base harness
// (a11y-axe.mjs) only sees each route's landing state, so the command-bar
// dropdown, model-commentary ACCEPT/UNDO, sub-lg evidence slide-over, gated
// view tablist and graph overlay legend go unscanned without this companion.
// Model-lane states are driven via Playwright route mocks (works keyless):
// capabilities is patched to enable model_lane, /overlay is synthesized from
// the real graph's issuer ids, and POST /links is echoed back — ACCEPT is then
// actually clicked to reach the UNDO state (listQueryLinks fires on mount,
// before any graph exists, so a mocked GET can't seed it).
// Run: cd caos/frontend && [BASE=http://localhost:3010] node scripts/a11y-query.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE || 'http://localhost:3000';
const TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
const CODE = process.env.ANALYST_SIGNUP_CODE || '131113';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const r = await page.request.post(BASE + '/api/auth/profile', { data: { code: CODE, name: 'A11y Bot' } });
if (!r.ok()) { console.error(`login failed ${r.status()}`); process.exit(1); }

// Seed Recent history so the dropdown renders both sections.
await page.addInitScript(() => {
  localStorage.setItem('caos:query-history', JSON.stringify([
    { text: 'who are the peers of viasat', capId: 'peer-set', capLabel: 'Peer set' },
    { text: 'contagion from six flags', capId: 'contagion', capLabel: 'Contagion' },
  ]));
});

// ── Route mocks: force model_lane on, capture the real graph, synthesize an
// overlay whose edges reference real issuer ids (one ACCEPT, one UNDO, one view-only).
let lastGraph = null;
await page.route('**/api/query/capabilities', async (route) => {
  const resp = await route.fetch();
  const body = await resp.json();
  body.availability = { ...(body.availability || {}), model_lane: true };
  await route.fulfill({ response: resp, body: JSON.stringify(body) });
});
await page.route('**/api/query/graph', async (route) => {
  const resp = await route.fetch();
  const body = await resp.json();
  lastGraph = body;
  await route.fulfill({ response: resp, body: JSON.stringify(body) });
});
const issuers = () => (lastGraph?.nodes ?? []).filter(n => n.kind === 'issuer' || n.kind === 'center').map(n => n.id);
await page.route('**/api/query/overlay', async (route) => {
  const ids = issuers();
  const edges = [];
  if (ids.length >= 2) edges.push({ source: ids[0], target: ids[1], rationale: 'Shared satellite-capacity offtake exposure.', chunk_ids: ['chunkmock01'], confidence: 'Medium' });
  if (ids.length >= 4) edges.push({ source: ids[2], target: ids[3], rationale: 'Common sponsor and overlapping lender group.', chunk_ids: ['chunkmock02'], confidence: 'High' });
  if (ids.length >= 1) edges.push({ source: ids[0], target: 'claim:mock', rationale: 'Run-scoped claim reference.', chunk_ids: ['chunkmock03'], confidence: 'Low' });
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    edges, commentary: 'Model-proposed view: capacity offtake concentration links these credits beyond the deterministic peer walk.',
    suggested_walks: ['contagion'], capability_id: lastGraph?.capability_id ?? 'peer-set',
    model: 'mock-model-1', created_at: '2026-07-02T00:00:00Z', cached: false,
  }) });
});
await page.route('**/api/query/links', async (route) => {
  const req = route.request();
  if (req.method() === 'POST') {
    // Echo the accept back as a stored link → drives the real ACCEPT→UNDO transition.
    const b = req.postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'lnk-mock-1', issuer_a: b.source_issuer_id, issuer_b: b.target_issuer_id, capability_id: b.capability_id,
      rationale: b.rationale, chunk_ids: b.chunk_ids, confidence: b.confidence, model: b.model, analyst_id: null, created_at: null, created: true,
    }) });
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ links: [] }) });
});

const out = {};
async function scan(name) {
  await page.addScriptTag({ path: axePath });
  out[name] = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return { violations: r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help, wcag: v.tags.filter(t=>t.startsWith('wcag')), n: v.nodes.length,
      nodes: v.nodes.slice(0,5).map(n => ({ target: n.target, summary: n.failureSummary })),
    })) };
  }, TAGS);
}

await page.goto(BASE + '/query', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('[role="tablist"]', { timeout: 30000 }); // graph loaded → tablist + legend live
await page.waitForTimeout(700);
await scan('query-base');

// Command-bar focus dropdown (Recent + Runnable now)
await page.focus('input[aria-label="Query coverage"]');
await page.waitForSelector('text=Runnable now', { timeout: 5000 });
await scan('command-dropdown');
await page.keyboard.press('Escape');

// Model overlay → commentary + ACCEPT/UNDO in dock, model-proposed legend on canvas
await page.click('text=MODEL OVERLAY');
await page.waitForSelector('[data-testid="model-commentary"]', { timeout: 10000 });
await page.waitForSelector('text=ACCEPT', { timeout: 5000 });
await page.getByRole('button', { name: 'ACCEPT' }).nth(1).click(); // ratify edge B → its row flips to UNDO
await page.waitForSelector('text=UNDO', { timeout: 5000 });
await scan('model-overlay');

// Sub-lg slide-over (overlay still on → commentary inside the sheet)
await page.setViewportSize({ width: 900, height: 800 });
await page.waitForTimeout(800);
for (let i = 0; i < 3; i++) { // re-render race: a lost click just toggles nothing — retry
  await page.getByRole('button', { name: 'EVIDENCE', exact: true }).click();
  try { await page.waitForSelector('[role="dialog"][aria-label="Evidence"]', { timeout: 3000 }); break; }
  catch (e) { if (i === 2) throw e; }
}
await scan('evidence-slideover');

await browser.close();
let total = 0; const byImpact = {};
for (const s of Object.values(out)) for (const v of s.violations) { total += v.n; byImpact[v.impact] = (byImpact[v.impact]||0)+v.n; }
console.log(JSON.stringify({ base: BASE, total_nodes: total, byImpact, states: out }, null, 2));
process.exit(total > 0 ? 1 : 0);
