// Reproducible Task 4A browser gate for Portfolio cold-state geometry and the
// Sector More menu. Width scans use real layout viewports; the zoom phase uses
// headed Chromium's native chrome://settings Appearance control.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const base = process.env.BASE || "http://127.0.0.1:4175";
const evidenceDir = process.env.EVIDENCE_DIR || "/private/tmp/caos-task4a-portfolio-sector";
const evidenceJson = process.env.EVIDENCE_JSON || `${evidenceDir}/evidence.json`;
const profileDir = process.env.PROFILE_DIR || "/private/tmp/caos-task4a-native-zoom-profile";
const widths = [1440, 1280, 1024, 768];
const identity = {
  id: "task4a-browser",
  email: "task4a-browser@local.dev",
  full_name: "Task 4A Browser Gate",
  role: "analyst",
  is_active: true,
  source: "local",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function menuGeometry(page) {
  const summary = page.getByText("More", { exact: true });
  await summary.click();
  const menu = page.locator("[data-sector-more-menu]");
  await menu.waitFor();
  await page.getByRole("button", { name: "Early Warning" }).waitFor();
  await page.getByRole("button", { name: "Sources" }).waitFor();
  return menu.evaluate((element) => {
    const source = element.getBoundingClientRect();
    const effective = {
      left: Math.max(0, source.left),
      right: Math.min(innerWidth, source.right),
      top: Math.max(0, source.top),
      bottom: Math.min(innerHeight, source.bottom),
    };
    const clippingOwners = [];
    for (let owner = element.parentElement; owner; owner = owner.parentElement) {
      const style = getComputedStyle(owner);
      const clipsX = ["auto", "scroll", "hidden", "clip"].includes(style.overflowX);
      const clipsY = ["auto", "scroll", "hidden", "clip"].includes(style.overflowY);
      if (!clipsX && !clipsY) continue;
      const clip = owner.getBoundingClientRect();
      if (clipsX) {
        effective.left = Math.max(effective.left, clip.left);
        effective.right = Math.min(effective.right, clip.right);
      }
      if (clipsY) {
        effective.top = Math.max(effective.top, clip.top);
        effective.bottom = Math.min(effective.bottom, clip.bottom);
      }
      clippingOwners.push({ className: typeof owner.className === "string" ? owner.className : "", overflowX: style.overflowX, overflowY: style.overflowY });
    }
    const rect = { left: source.left, right: source.right, top: source.top, bottom: source.bottom, width: source.width, height: source.height };
    const fullyVisible = Math.abs(rect.left - effective.left) <= 1
      && Math.abs(rect.right - effective.right) <= 1
      && Math.abs(rect.top - effective.top) <= 1
      && Math.abs(rect.bottom - effective.bottom) <= 1;
    return {
      rect,
      effective,
      fullyVisible,
      viewport: { width: innerWidth, height: innerHeight },
      ownerIsHorizontalScroller: element.parentElement?.parentElement?.hasAttribute("data-sector-tabs-scroll") ?? false,
      clippingOwners,
    };
  });
}

function assertMenu(routeLabel, geometry) {
  assert(geometry.fullyVisible, `${routeLabel}: Sector More menu is clipped: ${JSON.stringify(geometry)}`);
  assert(!geometry.ownerIsHorizontalScroller, `${routeLabel}: Sector More menu is owned by the horizontal tab scroller`);
  assert(geometry.rect.left >= -1 && geometry.rect.right <= geometry.viewport.width + 1, `${routeLabel}: Sector More menu leaves the viewport`);
}

async function installFixtures(page) {
  await installSurfaceStubs(page, identity);
  page.setDefaultTimeout(15_000);
}

await mkdir(evidenceDir, { recursive: true });
const result = {
  generatedAt: new Date().toISOString(),
  base,
  viewportMatrix: [],
  nativeZoom: [],
};

const matrixBrowser = await chromium.launch({ headless: true });
const matrixPage = await matrixBrowser.newPage({ viewport: { width: widths[0], height: 900 } });
await installFixtures(matrixPage);
for (const width of widths) {
  await matrixPage.setViewportSize({ width, height: 900 });
  await matrixPage.goto(`${base}/sector`, { waitUntil: "domcontentloaded" });
  await matrixPage.getByRole("heading", { level: 1, name: "Sector Review" }).waitFor();
  const menu = await menuGeometry(matrixPage);
  assertMenu(`${width}px`, menu);
  const documentOverflow = await matrixPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(documentOverflow <= 1, `${width}px: page overflows by ${documentOverflow}px`);
  await matrixPage.screenshot({ path: `${evidenceDir}/sector-more-${width}.png`, fullPage: false });
  result.viewportMatrix.push({ width, height: 900, documentOverflow, menu });
}
await matrixBrowser.close();

const zoomContext = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  args: ["--window-size=1440,1000", "--no-first-run", "--disable-default-apps"],
});
const settings = zoomContext.pages()[0] ?? await zoomContext.newPage();
await settings.goto("chrome://settings/appearance");
const zoomControl = settings.locator("#zoomLevel");
await zoomControl.waitFor();
if (Number(await zoomControl.inputValue()) !== 2) await zoomControl.selectOption("2");
assert(Number(await zoomControl.inputValue()) === 2, "Native browser zoom is not 200%");

const zoomPage = await zoomContext.newPage();
await installFixtures(zoomPage);
for (const route of ["/portfolios", "/sector"]) {
  await zoomPage.goto(base + route, { waitUntil: "domcontentloaded" });
  await zoomPage.locator(".caos-enterprise-page").waitFor();
  const metrics = await zoomPage.evaluate(() => ({
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    dpr: devicePixelRatio,
    visualScale: visualViewport?.scale ?? null,
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  const observedZoom = metrics.outerWidth / metrics.innerWidth;
  assert(Math.abs(observedZoom - 2) < 0.08, `${route}: observed native zoom ${observedZoom}`);
  assert(metrics.dpr >= 2, `${route}: DPR ${metrics.dpr} does not reflect 200% native zoom`);
  assert(metrics.visualScale === 1, `${route}: visual viewport scale indicates emulation`);
  assert(metrics.documentOverflow <= 1, `${route}: page overflows by ${metrics.documentOverflow}px`);
  const routeResult = { route, observedZoom, metrics };
  if (route === "/portfolios") {
    const bespokeEyebrows = await zoomPage.locator(".portfolio-lab__eyebrow").count();
    assert(bespokeEyebrows === 0, "/portfolios: bespoke eyebrow class remains mounted");
    routeResult.bespokeEyebrows = bespokeEyebrows;
  } else {
    routeResult.menu = await menuGeometry(zoomPage);
    assertMenu("native 200%", routeResult.menu);
  }
  await zoomPage.screenshot({ path: `${evidenceDir}/${route.slice(1)}-native-zoom-200.png`, fullPage: false });
  result.nativeZoom.push(routeResult);
}
await zoomContext.close();

await writeFile(evidenceJson, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
