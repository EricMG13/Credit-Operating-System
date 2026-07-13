// Multi-viewport layout gate for every Workbench/Atlas route. Specialist
// editors may own internal scrolling; the document itself must never overflow.
import { chromium } from 'playwright';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const routes = ['/issuers/','/issuers/profile/?id=a71f0000-0000-0000-0000-000000000001','/upload/','/research/','/query/','/sector/','/sector-rv/','/command/','/deepdive/','/model/','/reports/','/pipeline/','/monitor/','/sponsors/','/settings/'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900, zoom: 1 },
  { name: 'laptop', width: 1280, height: 800, zoom: 1 },
  { name: 'tablet', width: 1024, height: 768, zoom: 1 },
  { name: 'phone', width: 390, height: 844, zoom: 1 },
  { name: 'zoom200', width: 720, height: 450, zoom: 2 },
];

const browser = await chromium.launch();
const context = await browser.newContext();
if (process.env.LIVE_API === '1') {
  const response = await context.request.post(BASE + '/api/auth/profile', { data: { code: process.env.ANALYST_SIGNUP_CODE || '131113', name: 'Layout Bot' } });
  if (!response.ok()) throw new Error(`Preview login failed (${response.status()})`);
} else {
  await installSurfaceStubs(context, { id: 'layout-local', email: 'layout@local.dev', full_name: 'Layout Bot', role: 'analyst', is_active: true, source: 'local' });
}
const page = await context.newPage();
const failures = [];
let checked = 0;
for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, viewport.zoom);
    await page.locator('.caos-enterprise-page').waitFor({ state: 'visible' });
    const result = await page.evaluate(() => ({
      path: location.pathname,
      root: !!document.querySelector('.caos-enterprise-page'),
      primaryActions: document.querySelectorAll('[data-page-primary-action]').length,
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      width: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll('body *')).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 2 || rect.left < -2;
      }).slice(0, 8).map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
        text: (element.textContent || '').trim().slice(0, 60),
        rect: [Math.round(element.getBoundingClientRect().left), Math.round(element.getBoundingClientRect().right)],
      })),
    }));
    checked += 1;
    if (!result.root || result.primaryActions !== 1 || result.documentOverflow) failures.push({ viewport: viewport.name, route, ...result });
  }
}
await browser.close();
console.log(JSON.stringify({ checked, failures }, null, 2));
if (failures.length) process.exitCode = 1;
