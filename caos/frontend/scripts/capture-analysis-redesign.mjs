import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const OUT = process.env.OUT || 'outputs/query-sector-rv-redesign';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const login = await page.request.post(`${BASE}/api/auth/profile`, {
  data: { code: process.env.ANALYST_SIGNUP_CODE || '131113', name: 'Redesign Review' },
});
if (!login.ok()) throw new Error(`Preview login failed: ${login.status()}`);

await page.goto(`${BASE}/sector/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Request refresh' }).waitFor();
await page.getByRole('button', { name: 'Request refresh' }).click();
await page.getByRole('heading', { name: 'Seven-section dossier' }).waitFor();
await page.getByRole('radio', { name: 'QA', exact: true }).click();
await page.getByRole('heading', { name: 'Source register' }).waitFor();
await page.getByRole('radio', { name: 'Analyst', exact: true }).click();
await page.getByRole('heading', { name: 'Seven-section dossier' }).waitFor();
const sectorUrl = new URL(page.url());
const contextId = sectorUrl.searchParams.get('context');
if (!contextId) throw new Error('Sector Review did not establish an analysis context.');
await page.screenshot({ path: `${OUT}/sector-review-desktop.png`, fullPage: false });

await page.getByRole('link', { name: 'Open sector in RV' }).click();
await page.waitForURL((url) => url.pathname.startsWith('/sector-rv'));
if (new URL(page.url()).searchParams.get('context') !== contextId) throw new Error('Sector → RV handoff lost context.');
await page.getByRole('button', { name: 'Run screen' }).click();
await page.getByRole('grid', { name: 'Ranked RV candidates' }).waitFor();
const firstCandidate = page.getByRole('row').nth(1).getByRole('button').first();
await firstCandidate.focus();
await firstCandidate.press('ArrowDown');
await page.screenshot({ path: `${OUT}/rv-screener-desktop.png`, fullPage: false });

await page.getByRole('link', { name: 'Investigate' }).click();
await page.waitForURL((url) => url.pathname.startsWith('/query'));
if (new URL(page.url()).searchParams.get('context') !== contextId) throw new Error('RV → Query handoff lost context.');
const composer = page.getByLabel('Query coverage');
await composer.fill('which issuers are most levered');
await page.getByRole('button', { name: 'Run Query' }).click();
await page.locator('[aria-label="Query answer"]').getByText(/Native metric view|Question preserved/).first().waitFor();
await page.screenshot({ path: `${OUT}/query-desktop.png`, fullPage: false });
await page.getByRole('button', { name: 'Pin finding' }).click();
await page.getByText('1 pinned').waitFor();
await page.getByRole('button', { name: 'Query utilities' }).click();
await page.getByRole('link', { name: 'Open in Report Studio' }).click();
await page.waitForURL((url) => url.pathname.startsWith('/reports'));
if (new URL(page.url()).searchParams.get('context') !== contextId) throw new Error('Query → Report Studio handoff lost context.');
await page.screenshot({ path: `${OUT}/report-studio-handoff-desktop.png`, fullPage: false });

const routeUrls = [
  ['sector-review', `${BASE}/sector/?context=${contextId}`],
  ['rv-screener', `${BASE}/sector-rv/?context=${contextId}`],
  ['query', `${BASE}/query/?context=${contextId}`],
];
const layoutResults = [];
for (const viewport of [
  { name: 'laptop', width: 1280, height: 800, zoom: 1 },
  { name: 'tablet', width: 1024, height: 768, zoom: 1 },
  { name: 'phone', width: 390, height: 844, zoom: 1 },
  { name: 'zoom200', width: 720, height: 450, zoom: 2 },
]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  for (const [name, url] of routeUrls) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.caos-enterprise-page').waitFor({ state: 'visible' });
    await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, viewport.zoom);
    const layout = await page.evaluate(() => ({
      path: location.pathname,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      width: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      primaryActions: document.querySelectorAll('[data-page-primary-action]').length,
    }));
    layoutResults.push({ name, viewport: viewport.name, ...layout });
    await page.screenshot({ path: `${OUT}/${name}-${viewport.name}.png`, fullPage: false });
  }
}

await browser.close();
const failures = layoutResults.filter((item) => item.overflow || item.primaryActions !== 1);
console.log(JSON.stringify({ contextId, screenshots: 16, layoutResults, failures }, null, 2));
if (failures.length) process.exitCode = 1;
