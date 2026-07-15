// Completion evidence for the Workbench + Atlas remediation. This browser-only
// capture stubs identity for the static export; it never changes application
// auth or writes server data.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const OUT = process.env.OUT || 'outputs/enterprise-remediation/screenshots';
const allRoutes = [
  ['directory', '/issuers/'], ['issuer-profile', '/issuers/profile/?id=a71f0000-0000-0000-0000-000000000001'], ['upload', '/upload/'], ['research', '/research/'],
  ['query', '/query/'], ['sector-review', '/sector/'], ['sector-rv', '/sector-rv/'],
  ['command', '/command/'], ['deep-dive', '/deepdive/'], ['model', '/model/'],
  ['portfolio-lab', '/portfolios/?portfolio=portfolio-1&selected=position-1&context=context-1'],
  ['ic-book', '/decisions/?selected=agenda-1&context=context-1'],
  ['report-studio', '/reports/'], ['pipeline', '/pipeline/'], ['monitor', '/monitor/'],
  ['sponsors', '/sponsors/'], ['settings', '/settings/'],
];
const requestedRoutes = process.env.ROUTES
  ? new Set(process.env.ROUTES.split(',').map((route) => route.endsWith('/') ? route : `${route}/`))
  : null;
const routes = requestedRoutes
  ? allRoutes.filter(([, route]) => requestedRoutes.has(new URL(route, 'http://local').pathname))
  : allRoutes;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
if (process.env.LIVE_API === '1') {
  const response = await context.request.post(BASE + '/api/auth/profile', { data: { code: process.env.ANALYST_SIGNUP_CODE || '131113', name: 'Capture Analyst' } });
  if (!response.ok()) throw new Error(`Preview login failed (${response.status()})`);
} else {
  await installSurfaceStubs(context, { id: 'capture-local', email: 'capture@local.dev', full_name: 'Capture Analyst', role: 'analyst', is_active: true, source: 'local' });
}
const page = await context.newPage();
for (const [name, route] of routes) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => page.goto(BASE + route, { waitUntil: 'domcontentloaded' }));
  await page.locator('.caos-enterprise-page').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/${name}-desktop.png`, fullPage: false });
}

for (const [name, route] of routes) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => page.goto(BASE + route, { waitUntil: 'domcontentloaded' }));
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await page.locator('.caos-enterprise-page').waitFor({ state: 'visible' });
  if (name === 'ic-book' || name === 'portfolio-lab') {
    const drawer = page.getByRole('button', { name: /open evidence inspector drawer/i });
    if (await drawer.isVisible().catch(() => false)) {
      await drawer.click();
      await page.getByRole('dialog', { name: 'Evidence inspector' }).waitFor({ state: 'visible' });
    }
  }
  await page.screenshot({ path: `${OUT}/${name}-narrow.png`, fullPage: false });
}

const allMatrices = [
  ['command', '/command/', 1280, 800, 1],
  ['model', '/model/', 1024, 768, 1],
  ['monitor', '/monitor/', 390, 844, 1],
  ['directory', '/issuers/', 720, 900, 2],
];
const matrices = requestedRoutes
  ? allMatrices.filter(([, route]) => requestedRoutes.has(route))
  : allMatrices;
for (const [name, route, width, height, zoom] of matrices) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => page.goto(BASE + route, { waitUntil: 'domcontentloaded' }));
  await page.evaluate((factor) => { document.documentElement.style.zoom = String(factor); }, zoom);
  await page.locator('.caos-enterprise-page').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/${name}-${width}x${height}${zoom > 1 ? '-zoom200' : ''}.png`, fullPage: false });
}
await browser.close();
console.log(JSON.stringify({ out: OUT, desktop: routes.length, narrow: routes.length, responsive: matrices.length }, null, 2));
