/**
 * PD-05 browser proof for the shipped Next.js error boundaries.
 *
 * The fault exists only in Playwright's response body for one exported chunk.
 * No query flag, environment switch, or throw branch is added to production
 * source. Every rewrite is sentinel-scoped and exact-cardinality so compiler
 * drift fails closed instead of turning this into a green no-fault test.
 */

import { expect, test, type Page } from "@playwright/test";

const REFERENCE_ISSUER_ID = "a71f0000-0000-0000-0000-000000000001";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface FaultContract {
  sentinel: string;
  componentPattern: RegExp;
  boundarySentinel: string;
  resetPattern: RegExp;
  sessionKey: string;
  failureName: string;
}

interface InjectionEvidence {
  componentRewrites: number;
  resetRewrites: number;
  matchedUrls: string[];
}

const SEGMENT_FAULT: FaultContract = {
  sentinel: "Report Studio — committee deliverables",
  componentPattern: /function [A-Za-z_$][\w$]*\(\{issuerId:[A-Za-z_$][\w$]*,isReference:[A-Za-z_$][\w$]*\}\)\{/g,
  boundarySentinel: "Retry view load",
  resetPattern: /onClick:([A-Za-z_$][\w$]*)(?=,className:"rounded border border-caos-accent bg-caos-accent)/g,
  sessionKey: "caos:pd05:reports-render:consumed",
  failureName: "PD-05 injected Report Studio render failure",
};

const ROOT_FAULT: FaultContract = {
  sentinel: "CAOS Command Center",
  componentPattern: /[A-Za-z_$][\w$]*\.s\(\["WorkflowRail",0,function\(\)\{/g,
  boundarySentinel: "The workspace failed to load",
  resetPattern: /onClick:([A-Za-z_$][\w$]*)(?=,style:\{marginTop:"1\.25rem")/g,
  sessionKey: "caos:pd05:workflow-rail-render:consumed",
  failureName: "PD-05 injected WorkflowRail render failure",
};

function exactMatches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => match[0]);
}

function faultStatement(contract: FaultContract): string {
  const key = JSON.stringify(contract.sessionKey);
  const name = JSON.stringify(contract.failureName);
  return `if(sessionStorage.getItem(${key})==="armed"){sessionStorage.setItem("caos:pd05:last-failure",${name});throw new Error(${name});}`;
}

function resetHandler(contract: FaultContract, resetName: string): string {
  const key = JSON.stringify(contract.sessionKey);
  return `onClick:()=>{sessionStorage.setItem(${key},"consumed");${resetName}()}`;
}

async function injectOneShotChunkFailure(
  page: Page,
  contract: FaultContract,
): Promise<InjectionEvidence> {
  const evidence: InjectionEvidence = { componentRewrites: 0, resetRewrites: 0, matchedUrls: [] };
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const isComponent = source.includes(contract.sentinel) && evidence.componentRewrites === 0;
    const isBoundary = source.includes(contract.boundarySentinel) && evidence.resetRewrites === 0;
    if (!isComponent && !isBoundary) {
      await route.fulfill({ response });
      return;
    }
    let rewritten = source;
    if (isComponent) {
      const matches = exactMatches(source, contract.componentPattern);
      if (matches.length !== 1) {
        throw new Error(
          `${contract.failureName}: expected one component token in the sentinel chunk, found ${matches.length}.`,
        );
      }
      rewritten = source.replace(matches[0], `${matches[0]}${faultStatement(contract)}`);
      evidence.componentRewrites += 1;
    } else {
      const matches = [...source.matchAll(new RegExp(contract.resetPattern.source, contract.resetPattern.flags))];
      if (matches.length !== 1 || !matches[0][1]) {
        throw new Error(
          `${contract.failureName}: expected one reset handler in the boundary chunk, found ${matches.length}.`,
        );
      }
      rewritten = source.replace(matches[0][0], resetHandler(contract, matches[0][1]));
      evidence.resetRewrites += 1;
    }
    const headers = { ...response.headers(), "cache-control": "no-store" };
    delete headers["content-encoding"];
    delete headers["content-length"];
    evidence.matchedUrls.push(route.request().url());
    await route.fulfill({ status: response.status(), headers, body: rewritten });
  });
  return evidence;
}

function mutationLedger(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!MUTATING_METHODS.has(request.method())) return;
    writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  return writes;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
});

test.describe("PD-05 Next.js recovery boundaries", () => {
  test("root-layout failure reaches global-error and retries in the authenticated tab without writes", async ({ page }) => {
    const writes = mutationLedger(page);
    const injection = await injectOneShotChunkFailure(page, ROOT_FAULT);

    await page.goto("/settings/?mode=reference");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });
    expect(injection.componentRewrites).toBe(1);
    expect(injection.resetRewrites).toBe(1);
    expect(injection.matchedUrls).toHaveLength(2);
    expect(writes).toEqual([]);
    await page.evaluate((key) => {
      const workflowToggle = [...document.querySelectorAll("summary")]
        .find((element) => element.textContent?.trim() === "All Workflows") as HTMLElement | undefined;
      if (!workflowToggle) throw new Error("PD-05 could not find the WorkflowRail state control.");
      sessionStorage.setItem(key, "armed");
      workflowToggle.click();
    }, ROOT_FAULT.sessionKey);

    const fatal = page.getByRole("alert").filter({ hasText: "The workspace failed to load" });
    await expect(fatal).toContainText("The workspace failed to load", { timeout: 15000 });
    await expect(fatal.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("caos:pd05:last-failure")))
      .toBe(ROOT_FAULT.failureName);
    expect(new URL(page.url()).pathname).toBe("/settings/");
    expect(new URL(page.url()).searchParams.get("mode")).toBe("reference");
    expect(writes).toEqual([]);

    await fatal.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("link", { name: "CAOS Command Center" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(writes).toEqual([]);
    const profile = await page.request.get("/api/auth/me");
    expect(profile.ok(), `profile after root recovery returned ${profile.status()}`).toBe(true);
  });

  test("segment failure preserves context and durable report draft with one recovery autosave", async ({ page, request }, testInfo) => {
    const caseId = `${testInfo.project.name}-${Date.now()}`;
    const contextResponse = await request.post("/api/analysis/contexts", {
      data: {
        name: `PD-05 report recovery ${caseId}`,
        selected: { pd05_case: caseId },
      },
    });
    expect(contextResponse.ok(), `context create returned ${contextResponse.status()}`).toBe(true);
    const context = await contextResponse.json() as { id: string };
    const draftPayload = {
      issuer_id: REFERENCE_ISSUER_ID,
      active_id: "memo",
      omit: {},
      edits: { memo: { "s0.body": "PD-05 preserved committee draft" } },
      paper: "#f7f5ee",
      show_sources: false,
      hide_addbacks: false,
    };
    const seedDraft = await request.put(`/api/reports/drafts/${context.id}`, {
      data: { payload: draftPayload },
    });
    expect(seedDraft.ok(), `draft seed returned ${seedDraft.status()}`).toBe(true);
    expect((await seedDraft.json() as { revision: number }).revision).toBe(1);

    const writes = mutationLedger(page);
    const injection = await injectOneShotChunkFailure(page, SEGMENT_FAULT);
    await page.goto(`/reports/?mode=reference&context=${encodeURIComponent(context.id)}`);
    await expect(page.getByLabel("Report preview")).toBeVisible({ timeout: 15000 });
    expect(injection.componentRewrites).toBe(1);
    expect(injection.resetRewrites).toBe(1);
    expect(injection.matchedUrls).toHaveLength(2);
    const draftPath = `PUT /api/reports/drafts/${context.id}`;
    await expect.poll(() => writes.filter((entry) => entry === draftPath).length, { timeout: 15000 }).toBe(1);
    const preFailureDraftWrites = writes.filter((entry) => entry === draftPath).length;
    expect(preFailureDraftWrites).toBe(1);
    const preFailure = await request.get(`/api/reports/drafts/${context.id}`);
    expect(preFailure.ok(), `pre-failure draft read returned ${preFailure.status()}`).toBe(true);
    const preFailureDraft = await preFailure.json() as { revision: number; payload: typeof draftPayload };
    expect(preFailureDraft.revision).toBe(2);
    expect(preFailureDraft.payload).toEqual(draftPayload);
    await page.getByRole("button", { name: "Open Report utilities" }).click();
    const utilities = page.getByRole("dialog", { name: "Report utilities" });
    const sources = utilities.getByRole("button", { name: "SOURCES" });
    await expect(sources).toHaveAttribute("aria-pressed", "false");
    const preFailureUrl = new URL(page.url());
    expect(preFailureUrl.pathname).toBe("/reports/");
    expect(preFailureUrl.searchParams.get("mode")).toBe("reference");
    await page.evaluate((key) => sessionStorage.setItem(key, "armed"), SEGMENT_FAULT.sessionKey);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), SEGMENT_FAULT.sessionKey)).toBe("armed");
    await sources.click();

    const routeError = page.getByRole("alert").filter({ hasText: "This view could not load" });
    await expect(routeError).toContainText("This view could not load", { timeout: 15000 });
    await expect(routeError.getByRole("button", { name: "Retry view load" })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("caos:pd05:last-failure")))
      .toBe(SEGMENT_FAULT.failureName);
    const failedUrl = new URL(page.url());
    expect(failedUrl.pathname).toBe("/reports/");
    expect(failedUrl.searchParams.get("mode")).toBe("reference");
    expect(writes.filter((entry) => entry === draftPath)).toHaveLength(preFailureDraftWrites);

    await routeError.getByRole("button", { name: "Retry view load" }).click();
    await expect(page.getByLabel("Report preview")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /IC Credit Memo/ })).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("1 analyst override applied", { exact: true })).toBeVisible();
    await expect(page.getByText(`PD-05 report recovery ${caseId}`, { exact: true })).toBeVisible();
    await expect.poll(
      () => writes.filter((entry) => entry === draftPath).length,
      { timeout: 15000 },
    ).toBe(preFailureDraftWrites + 1);
    await page.getByRole("button", { name: "Open Report utilities" }).click();
    const recoveredUtilities = page.getByRole("dialog", { name: "Report utilities" });
    await expect(recoveredUtilities.getByRole("button", { name: "SOURCES" }))
      .toHaveAttribute("aria-pressed", "false");
    await expect(recoveredUtilities.getByText("Draft autosaved", { exact: true })).toBeVisible();

    expect(writes.filter((entry) => entry === draftPath)).toHaveLength(preFailureDraftWrites + 1);
    expect(writes.filter((entry) => entry.startsWith("POST /api/reports/versions"))).toHaveLength(0);
    const counts = new Map<string, number>();
    for (const write of writes) counts.set(write, (counts.get(write) ?? 0) + 1);
    expect([...counts.entries()].filter(([path, count]) => path !== draftPath && count > 1)).toEqual([]);

    const persisted = await request.get(`/api/reports/drafts/${context.id}`);
    expect(persisted.ok(), `draft reread returned ${persisted.status()}`).toBe(true);
    const persistedDraft = await persisted.json() as { revision: number; payload: typeof draftPayload };
    expect(persistedDraft.revision).toBe(preFailureDraft.revision + 1);
    expect(persistedDraft.payload).toEqual(draftPayload);
    const profile = await page.request.get("/api/auth/me");
    expect(profile.ok(), `profile after segment recovery returned ${profile.status()}`).toBe(true);
  });
});
