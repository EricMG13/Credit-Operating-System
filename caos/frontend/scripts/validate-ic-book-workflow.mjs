import { chromium } from 'playwright';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';

const BASE = process.env.BASE || 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const identity = {
  id: 'capture-local', email: 'capture@local.dev', full_name: 'Capture Analyst', role: 'analyst', is_active: true, source: 'local',
};
await installSurfaceStubs(context, identity);
const page = await context.newPage();
page.setDefaultTimeout(5_000);
page.setDefaultNavigationTimeout(10_000);

await page.goto(`${BASE}/decisions/?dataset=agenda&selected=agenda-1&context=context-1`, { waitUntil: 'domcontentloaded' });
try {
  await page.getByRole('table', { name: 'Committee agenda' }).waitFor({ timeout: 20_000 });
} catch (error) {
  console.error(await page.locator('body').innerText());
  throw error;
}
await page.getByRole('article', { name: 'Agenda inspector' }).waitFor();
await page.getByRole('button', { name: 'Review finalization' }).click();
await page.getByText('Freeze this committee record?').waitFor();
await page.getByRole('button', { name: 'Confirm finalization' }).click();
await page.getByRole('table', { name: 'Committee agenda' }).waitFor();
await page.locator('.ic-book__status[data-status="decided"]').first().waitFor();

await page.getByRole('tab', { name: 'Decision history' }).click();
await page.getByRole('table', { name: 'Decision history' }).waitFor();
await page.getByRole('button', { name: /13 Jul 2026/i }).click();
await page.getByRole('article', { name: 'Decision inspector' }).waitFor();
await page.getByLabel('Dissent rationale').fill('Downside case remains under-tested.');
await page.getByRole('button', { name: 'Record dissent' }).click();
await page.getByText(/dissent · capture-local/i).waitFor();
await page.getByLabel('Trigger alert key').fill('alert:iss-1:material-change');
await page.getByRole('button', { name: 'Reopen for material change' }).click();
await page.locator('.ic-book__status[data-status="reopened"]').first().waitFor();

const owners = await page.locator('[data-caos-dominant-table-owner]:visible').count();
if (owners !== 1) throw new Error(`IC Book expected one visible dominant table owner; found ${owners}`);

await page.setViewportSize({ width: 390, height: 844 });
await installSurfaceStubs(context, identity);
await page.goto(`${BASE}/decisions/?dataset=agenda&selected=agenda-1&context=context-1`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /open evidence inspector drawer/i }).click();
await page.getByRole('dialog', { name: 'Evidence inspector' }).waitFor();
await page.getByRole('button', { name: 'Review finalization' }).waitFor();
await page.keyboard.press('Escape');
await page.getByRole('dialog', { name: 'Evidence inspector' }).waitFor({ state: 'hidden' });

await browser.close();
console.log(JSON.stringify({ workflow: 'ic-book', desktop: 'agenda-finalize-history-vote-dissent-reopen', narrow: 'inspector-focus-escape', dominantTableOwners: owners }, null, 2));
