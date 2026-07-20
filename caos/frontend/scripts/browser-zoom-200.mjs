// Focused real-browser zoom audit. This connects to a headed Chrome profile
// whose native chrome://settings/appearance Page zoom is already set to 200%.
// It does not use CSS zoom, viewport emulation, or CDP emulation overrides.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { installSurfaceStubs } from "./browser-surface-fixtures.mjs";

const endpoint = process.env.CHROME_CDP || "http://127.0.0.1:9223";
const base = process.env.BASE || "http://localhost:3000";
const evidenceDir = process.env.EVIDENCE_DIR || "/private/tmp/caos-task2a-zoom-200";
const launchNativeZoom = process.env.LAUNCH_NATIVE_ZOOM === "1";
const profileDir = process.env.PROFILE_DIR || "/private/tmp/caos-browser-zoom-200-profile";
const routeHeadings = {
  "/": "CAOS Home",
  "/command": "Command Center",
  "/decisions": "IC Book",
  "/deepdive?mode=reference": "Deep-Dive",
  "/issuers": "Directory",
  "/issuers/profile?id=iss-1": "Issuer Profile",
  "/model?mode=reference": "Model Builder",
  "/monitor": "Alert Monitor",
  "/pipeline?mode=reference": "Pipeline",
  "/portfolios": "Portfolio Lab",
  "/query": "Query",
  "/reports?mode=reference": "Report Studio",
  "/research?mode=reference": "Research",
  "/sector": "Sector Review",
  "/sector-rv": "RV Screener",
  "/settings": "Settings",
  "/sponsors": "Sponsors",
  "/upload": "Upload",
};
const routes = (process.env.ZOOM_ROUTES || Object.keys(routeHeadings).join(","))
  .split(",")
  .map((path) => ({ path, heading: routeHeadings[path] }))
  .filter((route) => route.heading);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const domRect = (locator) => locator.evaluate((element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
});

await mkdir(evidenceDir, { recursive: true });
const browser = launchNativeZoom ? null : await chromium.connectOverCDP(endpoint);
const context = launchNativeZoom
  ? await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: null,
      args: ["--window-size=1440,1000", "--no-first-run", "--disable-default-apps"],
    })
  : browser.contexts()[0];
if (launchNativeZoom) {
  const appearance = context.pages()[0] ?? await context.newPage();
  await appearance.goto("chrome://settings/appearance");
  const zoomControl = appearance.locator("#zoomLevel");
  await zoomControl.waitFor();
  if (Number(await zoomControl.inputValue()) !== 2) await zoomControl.selectOption("2");
}
const settings = context.pages().find((page) => page.url().startsWith("chrome://settings"));
assert(settings, "Chrome Appearance settings tab is not open");
const nativeZoom = Number(await settings.locator("#zoomLevel").inputValue());
assert(nativeZoom === 2, `Chrome native Page zoom is ${nativeZoom}, expected 2`);

const page = context.pages().find((candidate) => candidate.url().startsWith(base)) ?? await context.newPage();
page.setDefaultTimeout(15_000);
const httpFailures = [];
page.on("response", (response) => {
  if (response.status() >= 400) httpFailures.push({ status: response.status(), url: response.url() });
});
  await installSurfaceStubs(page, {
  id: "zoom-local",
  email: "zoom@local.dev",
  full_name: "Zoom Audit",
  role: "analyst",
  is_active: true,
  source: "local",
});

const results = [];
for (const route of routes) {
  console.log(`zoom-audit: ${route.path}`);
  await page.goto(base + route.path, { waitUntil: "domcontentloaded" });
  if (route.path === "/") {
    // The home route resolves to the active role's first-priority workflow
    // after hydration. Audit that stable destination; the route-registry suite
    // separately covers the transient CAOS Home document title.
    await page.locator("h1").first().waitFor({ state: "visible" });
    await page.waitForTimeout(250);
    await page.locator("h1").first().waitFor({ state: "visible" });
  } else {
    await page.getByRole("heading", { level: 1, name: route.heading }).waitFor();
  }
  await page.locator(".caos-enterprise-page").waitFor();
  if (route.path.startsWith("/reports")) await page.locator(".caos-data-mode-marker").waitFor();

  const metrics = await page.evaluate(() => ({
    dpr: devicePixelRatio,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    visualScale: visualViewport?.scale ?? null,
    visualWidth: visualViewport?.width ?? null,
  }));
  const observedZoom = metrics.outerWidth / metrics.innerWidth;
  assert(Math.abs(observedZoom - 2) < 0.05, `${route.path}: observed browser zoom ${observedZoom}, expected 2`);
  assert(metrics.dpr >= 4, `${route.path}: DPR ${metrics.dpr} does not reflect 200% zoom on the Retina display`);
  assert(metrics.visualScale === 1, `${route.path}: visual viewport scale indicates page pinch/CSS emulation`);

  const layout = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const ownedByHorizontalScroller = (element) => {
      for (let owner = element.parentElement; owner; owner = owner.parentElement) {
        const style = getComputedStyle(owner);
        if (["auto", "scroll"].includes(style.overflowX) && owner.scrollWidth > owner.clientWidth + 1) return true;
      }
      return false;
    };
    const textBounds = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
      range.detach();
      if (rects.length === 0) return null;
      return {
        left: Math.min(...rects.map((rect) => rect.left)),
        right: Math.max(...rects.map((rect) => rect.right)),
        top: Math.min(...rects.map((rect) => rect.top)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
      };
    };
    const clippingAncestor = (element, bounds) => {
      for (let owner = element; owner && owner !== document.body; owner = owner.parentElement) {
        const style = getComputedStyle(owner);
        if (!["hidden", "clip"].includes(style.overflowX)) continue;
        const rect = owner.getBoundingClientRect();
        if (bounds.left < rect.left - 1 || bounds.right > rect.right + 1) {
          return {
            tag: owner.tagName,
            className: owner.className?.toString().slice(0, 160) || "",
            left: rect.left,
            right: rect.right,
          };
        }
      }
      return null;
    };
    const clippedControls = Array.from(document.querySelectorAll("button,a,input,select,textarea,[tabindex='0']"))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.tagName, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter((rect, index) => {
        const element = Array.from(document.querySelectorAll("button,a,input,select,textarea,[tabindex='0']")).filter(visible)[index];
        return (rect.left < -1 || rect.right > innerWidth + 1) && !ownedByHorizontalScroller(element);
      });
    const askRegions = Array.from(document.querySelectorAll('[aria-label="Ask utility"]')).filter(visible);
    const phoneAsk = Array.from(document.querySelectorAll(".caos-ask-phone-trigger")).filter(visible);
    const askEntries = Array.from(document.querySelectorAll('button[aria-label="Ask CAOS utility"],button[aria-label="Ask CAOS phone utility"]')).filter(visible);
    const headerControls = Array.from(document.querySelectorAll(".caos-subheader button,.caos-subheader a"))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          label: element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || element.tagName,
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        };
      });
    const headerOverlaps = headerControls.flatMap((left, index) => headerControls.slice(index + 1).flatMap((right) => {
      if (left.element.contains(right.element) || right.element.contains(left.element)) return [];
      const overlapX = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
      const overlapY = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
      return overlapX > 1 && overlapY > 1 ? [{ left: left.label, right: right.label, overlapX, overlapY }] : [];
    }));
    const currentWorkflow = Array.from(document.querySelectorAll(".caos-concept-chips [aria-current='page']")).find(visible);
    const workflowTrigger = Array.from(document.querySelectorAll("#workflow-disclosure")).find(visible);
    const horizontalScrollers = Array.from(document.querySelectorAll("body *"))
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      })
      .map((element) => ({
        tag: element.tagName,
        className: element.className?.toString().slice(0, 180) || "",
        label: element.getAttribute("aria-label"),
        role: element.getAttribute("role"),
        tabIndex: element.tabIndex,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        widestChildren: Array.from(element.children)
          .map((child) => {
            const rect = child.getBoundingClientRect();
            return {
              tag: child.tagName,
              className: child.className?.toString().slice(0, 160) || "",
              width: rect.width,
              scrollWidth: child.scrollWidth,
              text: child.textContent?.trim().replace(/\s+/g, " ").slice(0, 100) || "",
            };
          })
          .sort((left, right) => right.scrollWidth - left.scrollWidth)
          .slice(0, 4),
      }));
    const clippedText = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,li,dt,dd,caption,legend,label,[role='status'],.caos-workbench-description"))
      .filter(visible)
      .filter((element) => !element.classList.contains("sr-only"))
      .filter((element) => !ownedByHorizontalScroller(element))
      .map((element) => {
        const bounds = textBounds(element);
        if (!bounds) return null;
        const ancestor = clippingAncestor(element, bounds);
        const viewportClip = bounds.left < -1 || bounds.right > innerWidth + 1;
        if (!ancestor && !viewportClip) return null;
        return {
          tag: element.tagName,
          text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 180) || "",
          className: element.className?.toString().slice(0, 160) || "",
          bounds,
          ancestor,
          viewportClip,
        };
      })
      .filter(Boolean);
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clippedControls,
      clippedText,
      horizontalScrollers,
      headerOverlaps,
      headerEssentials: {
        markerVisible: Array.from(document.querySelectorAll(".caos-data-mode-marker")).some(visible),
        workflowTriggerVisible: Boolean(workflowTrigger),
        workflowTriggerText: workflowTrigger?.textContent?.trim().replace(/\s+/g, " ") || null,
        currentWorkflowVisible: Boolean(currentWorkflow),
        currentWorkflowLabel: currentWorkflow?.getAttribute("aria-label") || null,
      },
      askRegionCount: askRegions.length,
      phoneAskCount: phoneAsk.length,
      askEntries: askEntries.map((element) => ({ label: element.getAttribute("aria-label"), tag: element.tagName, disabled: element.matches(":disabled,[aria-disabled='true']") })),
      askRects: askRegions.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
    };
  });
  assert(layout.documentOverflow <= 1, `${route.path}: page overflows horizontally by ${layout.documentOverflow}px`);
  assert(layout.clippedControls.length === 0, `${route.path}: clipped controls ${JSON.stringify(layout.clippedControls)}`);
  assert(layout.clippedText.length === 0, `${route.path}: clipped narrative text ${JSON.stringify(layout.clippedText)}`);
  assert(layout.headerOverlaps.length === 0, `${route.path}: overlapping header controls ${JSON.stringify(layout.headerOverlaps)}`);
  assert(layout.headerEssentials.workflowTriggerVisible && layout.headerEssentials.workflowTriggerText?.includes("Workflows"), `${route.path}: labelled Workflows trigger is not visible at native zoom: ${JSON.stringify(layout.headerEssentials)}`);
  assert(layout.headerEssentials.currentWorkflowVisible, `${route.path}: current workflow is not visible at native zoom: ${JSON.stringify(layout.headerEssentials)}`);
  assert(layout.headerEssentials.markerVisible === route.path.includes("mode=reference"), `${route.path}: live/reference marker mismatch at native zoom: ${JSON.stringify(layout.headerEssentials)}`);
  const queryRoute = route.path === "/query";
  if (queryRoute) {
    assert(layout.askEntries.length === 0, `${route.path}: Query must not duplicate the global Ask entry: ${JSON.stringify(layout)}`);
    assert(layout.askRegionCount === 0, `${route.path}: Query must own its composer instead of a duplicate Ask region: ${JSON.stringify(layout)}`);
    assert(layout.phoneAskCount === 0, `${route.path}: Query exposed the coarse-phone Ask trigger: ${JSON.stringify(layout)}`);
  } else {
    assert(layout.askEntries.length === 1, `${route.path}: expected exactly one visible accessible Ask entry across responsive variants: ${JSON.stringify(layout)}`);
    assert(layout.askEntries[0]?.disabled === false, `${route.path}: the sole visible Ask entry is disabled: ${JSON.stringify(layout.askEntries)}`);
    assert(layout.askRegionCount === 1, `${route.path}: fine-pointer native zoom must retain one compact Ask region: ${JSON.stringify(layout)}`);
    assert(layout.phoneAskCount === 0, `${route.path}: fine-pointer native zoom exposed the coarse-phone Ask trigger: ${JSON.stringify(layout)}`);
    assert(layout.askEntries[0]?.label === "Ask CAOS utility", `${route.path}: fine-pointer native zoom retained the wrong Ask variant: ${JSON.stringify(layout.askEntries)}`);
  }

  // Let route-scoped shell effects settle before dispatching the physical
  // shortcut. Otherwise a just-completed navigation can close the newly opened
  // Ask surface in the same task.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    window.__task4cNativeShortcut = [];
    window.addEventListener("keydown", (event) => {
      if (event.altKey) window.__task4cNativeShortcut.push({ key: event.key, code: event.code, altKey: event.altKey });
    });
  });
  await page.keyboard.press("Alt+KeyK");
  const askDialog = page.locator('[role="dialog"][aria-label="Ask with Query"], [role="dialog"][aria-label$="Issuer Q&A"]');
  const queryComposer = page.getByRole("textbox", { name: "Query coverage" });
  if (queryRoute) await queryComposer.waitFor({ state: "visible" });
  else await askDialog.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  const shortcutEvents = await page.evaluate(() => window.__task4cNativeShortcut);
  const shortcutEvent = shortcutEvents.find((event) => event.code === "KeyK") ?? null;
  const shortcutDebug = await page.evaluate(() => ({
    activeElement: document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName || null,
    utilityExpanded: document.querySelector('button[aria-label="Ask CAOS utility"]')?.getAttribute("aria-expanded"),
    dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map((element) => element.getAttribute("aria-label")),
  }));
  console.log(`zoom-audit-shortcut: ${route.path} ${JSON.stringify({ shortcutEvents, shortcutDebug, httpFailures })}`);
  if (queryRoute) {
    assert(await queryComposer.evaluate((element) => element === document.activeElement), `${route.path}: Alt+K did not focus Query coverage: ${JSON.stringify({ shortcutEvents, shortcutDebug, httpFailures })}`);
  } else {
    assert(await askDialog.isVisible(), `${route.path}: Alt+K did not expose the accessible Ask dialog: ${JSON.stringify({ shortcutEvents, shortcutDebug, httpFailures })}`);
  }
  assert(shortcutEvent?.code === "KeyK" && shortcutEvent.altKey === true, `${route.path}: native Alt+K did not emit the physical KeyK chord: ${JSON.stringify(shortcutEvent)}`);
  if (!queryRoute) {
    await page.keyboard.press("Escape");
    await askDialog.waitFor({ state: "hidden" });
  }

  const routeResult = { route: route.path, nativeZoom, observedZoom, metrics, layout, shortcutEvent, askOpenedByAltK: !queryRoute, queryFocusedByAltK: queryRoute };
  if (route.path.startsWith("/reports")) {
    const utilitiesTrigger = page.getByRole("button", { name: "Open Report utilities" });
    const primaryAction = page.getByRole("button", { name: "Review frozen preview" });
    await utilitiesTrigger.waitFor();
    await primaryAction.waitFor();
    const reportControls = {
      utilities: await domRect(utilitiesTrigger),
      primary: await domRect(primaryAction),
    };
    for (const [name, rect] of Object.entries(reportControls)) {
      assert(rect && rect.x >= -1 && rect.x + rect.width <= metrics.innerWidth + 1, `Report ${name} control is outside the 200% layout viewport: ${JSON.stringify(rect)}`);
    }
    const proofing = await page.evaluate(() => ({
      bodyPx: parseFloat(getComputedStyle(document.querySelector(".rd-body")).fontSize),
      tablePx: parseFloat(getComputedStyle(document.querySelector(".rd-table td")).fontSize),
      metadataPx: parseFloat(getComputedStyle(document.querySelector(".rd-mast-meta")).fontSize),
    }));
    assert(proofing.bodyPx >= 12, `Report body shrank to ${proofing.bodyPx}px`);
    assert(proofing.tablePx >= 11, `Report table shrank to ${proofing.tablePx}px`);
    assert(proofing.metadataPx >= 10, `Report metadata shrank to ${proofing.metadataPx}px`);
    const reportUtilities = page.getByRole("button", { name: "Open Report utilities" });
    if (await reportUtilities.isVisible()) await reportUtilities.click();
    const zoomSlider = page.getByRole("slider", { name: "Document zoom" });
    await zoomSlider.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    assert(await zoomSlider.getAttribute("aria-valuetext") === "115 percent", "115% report zoom did not activate");
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    assert(await zoomSlider.getAttribute("aria-valuetext") === "100 percent", "Fit shrank below the 100% proofing floor");
    await page.keyboard.press("Escape");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const settledReportControls = {
      utilities: await domRect(utilitiesTrigger),
      primary: await domRect(primaryAction),
    };
    for (const [name, rect] of Object.entries(settledReportControls)) {
      assert(rect && rect.x >= -1 && rect.x + rect.width <= metrics.innerWidth + 1, `Settled Report ${name} control is outside the 200% layout viewport: ${JSON.stringify(rect)}`);
    }
    routeResult.proofing = proofing;
    routeResult.reportControls = reportControls;
    routeResult.settledReportControls = settledReportControls;
    routeResult.fixture = "REFERENCE";
    routeResult.reportFit = "100%";
  }

  const safeRouteName = route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
  await page.screenshot({ path: `${evidenceDir}/${safeRouteName}-chrome-zoom-200.png`, fullPage: false });
  results.push(routeResult);
}

const evidence = { endpoint, base, nativeZoom, httpFailures, results };
await writeFile(`${evidenceDir}/zoom-200-evidence.json`, JSON.stringify(evidence, null, 2) + "\n", "utf8");
console.log(JSON.stringify(evidence, null, 2));
assert(httpFailures.length === 0, `200% zoom HTTP failures: ${JSON.stringify(httpFailures)}`);
if (browser) await browser.close();
else await context.close();
