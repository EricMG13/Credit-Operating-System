// axe-core scan of the current Query investigation workbench's interactive
// states. The route-level harness only sees the initial page, so this companion
// covers lane selection, a completed persisted run, reload restoration, and the
// narrower analyst layout.
// Run: cd caos/frontend && [BASE=http://localhost:3010] node scripts/a11y-query.mjs
import { createRequire } from 'module';
import { summarizeAxeViolations } from './axe-results.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE || 'http://localhost:3000';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CODE = process.env.ANALYST_SIGNUP_CODE || '131113';
const edgeSecret = process.env.E2E_EDGE_PROXY_SECRET;
const forwardedEmail = process.env.E2E_FORWARDED_EMAIL || 'e2e-a11y-query@firm.test';
const analystName = process.env.E2E_ANALYST_NAME || 'A11y Query States';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  // The product CSP intentionally blocks injected scripts. This is a trusted,
  // local-only validation context and mirrors the route-level axe harness.
  bypassCSP: true,
  ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === '1',
  ...(edgeSecret ? { extraHTTPHeaders: {
    'X-Edge-Authorization': edgeSecret,
    'X-Forwarded-Email': forwardedEmail,
    'X-Forwarded-User': forwardedEmail,
    'X-Forwarded-Preferred-Username': analystName,
  } } : {}),
});

const login = await page.request.post(BASE + '/api/auth/profile', {
  data: { code: CODE, name: analystName },
});
if (!login.ok()) {
  console.error(`login failed ${login.status()}`);
  await browser.close();
  process.exit(1);
}

const out = {};
async function scan(name) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async (tags) => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: tags },
    });
    return result.violations;
  }, TAGS);
  out[name] = { violations: summarizeAxeViolations(violations, { nodeLimit: 5 }) };
}

await page.goto(BASE + '/query/', { waitUntil: 'domcontentloaded', timeout: 45000 });
const composer = page.getByRole('textbox', { name: 'Query coverage' });
await composer.waitFor({ state: 'visible', timeout: 30000 });
await page.getByRole('heading', { name: 'Ask one cross-coverage question.' }).waitFor({ timeout: 30000 });
await scan('query-ready');

const graphLane = page.getByRole('button', { name: 'graph', exact: true });
await graphLane.click();
await page.waitForURL(/(?:\?|&)lane=graph(?:&|$)/, { timeout: 10000 });
await graphLane.waitFor({ state: 'visible' });
await scan('graph-lane-selected');

// Select metric explicitly so the completed state exercises the dominant data
// region without requiring an external model provider.
await page.getByRole('button', { name: 'metric', exact: true }).click();
await composer.fill(`which issuer is most levered a11y-${Date.now()}`);
const run = page.getByRole('button', { name: 'Run Query', exact: true });
await run.waitFor({ state: 'visible' });
if (await run.isDisabled()) throw new Error('Run Query remained disabled after entering a question.');
await run.click();
await page.waitForURL(/(?:\?|&)run=/, { timeout: 30000 });
const answer = page.locator('[aria-label="Query answer"]').getByRole('heading', { level: 2 }).first();
await answer.waitFor({ state: 'visible', timeout: 30000 });
await scan('query-answer');

const answerText = ((await answer.textContent()) || '').trim();
await page.reload({ waitUntil: 'domcontentloaded' });
const restored = page.locator('[aria-label="Query answer"]').getByRole('heading', { level: 2 }).first();
await restored.waitFor({ state: 'visible', timeout: 30000 });
await page.waitForFunction(
  ({ expected }) => {
    const heading = document.querySelector('[aria-label="Query answer"] h2');
    return (heading?.textContent || '').trim() === expected;
  },
  { expected: answerText },
  { timeout: 30000 },
);
await page.setViewportSize({ width: 900, height: 800 });
await page.waitForTimeout(500);
await scan('persisted-answer-narrow');

await browser.close();

let total = 0;
const byImpact = {};
for (const state of Object.values(out)) {
  for (const violation of state.violations) {
    total += violation.n;
    byImpact[violation.impact] = (byImpact[violation.impact] || 0) + violation.n;
  }
}
console.log(JSON.stringify({ base: BASE, total_nodes: total, byImpact, states: out }, null, 2));
process.exit(total > 0 ? 1 : 0);
