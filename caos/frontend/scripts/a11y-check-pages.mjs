import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BASE = process.env.BASE || 'http://localhost:8000';
const ROUTES = '/,/command,/issuers,/deepdive,/pipeline,/model,/reports,/research,/upload,/settings,/query,/monitor'.split(',');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const CODE = '131113';
try {
  const r = await page.request.post(BASE + '/api/auth/profile', { data: { code: CODE, name: 'A11y Bot' } });
  console.log(`Login status: ${r.status()}`);
} catch (e) {
  console.error('Login error:', e.message);
}

for (const route of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 10000 });
  } catch {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 10000 });
  }
  await page.waitForTimeout(2000); // Wait 2s to be sure it's fully rendered
  const title = await page.title();
  const htmlContent = await page.evaluate(() => {
    const el = document.getElementById('main-content');
    return el ? el.innerHTML : 'No main-content element';
  });
  console.log(`Route: ${route}`);
  console.log(`- Final URL: ${page.url()}`);
  console.log(`- Title: ${title}`);
  console.log(`- Content starts with: ${htmlContent.substring(0, 150).replace(/\s+/g, ' ')}...`);
  console.log('---');
}

await browser.close();
