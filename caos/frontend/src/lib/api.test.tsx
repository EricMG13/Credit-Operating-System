// SEAM3-1 / SEAM3-2 regression: FastAPI 422 validation errors put a LIST of
// {loc, msg, type} objects in `detail` (and structured errors like the
// committee-export 409 put a DICT). The old `detail || e.message` parse fed
// that straight into string state; React then crashed rendering it as a child
// ("Objects are not valid as a React child") and the route error boundary ate
// the page. toErrorMessage is the mandatory parse — this pins that a
// 422-shaped axios error renders as a string.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, afterEach } from "vitest";
import { AxiosError } from "axios";

import { api, toErrorMessage, getResearchStatus, edgarVaultUrls, updateAnalystWorkspace } from "./api";

const err422 = {
  response: {
    status: 422,
    data: {
      detail: [
        { loc: ["body", "figi"], msg: "String should have at most 32 characters", type: "string_too_long" },
        { loc: ["body", "name"], msg: "String should have at least 1 character", type: "string_too_short" },
      ],
    },
  },
};

describe("toErrorMessage", () => {
  it("renders a 422 list detail as a string message, not a React-child crash", () => {
    // the pre-fix parse passed the raw array into JSX — that crashes React
    const raw = err422.response.data.detail as unknown as string;
    expect(() => renderToStaticMarkup(<span>{raw}</span>)).toThrow(/not valid as a React child/);
    // the normalizer yields a plain string that renders fine
    const msg = toErrorMessage(err422, "fallback");
    expect(typeof msg).toBe("string");
    const html = renderToStaticMarkup(<span>{msg}</span>);
    expect(html).toContain("figi: String should have at most 32 characters");
    expect(html).toContain("name: String should have at least 1 character");
  });

  it("reads dict details, string details, axios message, then the fallback", () => {
    // dict shape — the runs.py committee-export 409 pattern ({message, ...})
    expect(
      toErrorMessage({ response: { data: { detail: { message: "Run is not Committee Ready" } } } }, "f"),
    ).toBe("Run is not Committee Ready");
    expect(toErrorMessage({ response: { data: { detail: "plain detail" } } }, "f")).toBe("plain detail");
    expect(toErrorMessage({ message: "Network Error" }, "f")).toBe("Network Error");
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
    // dict without a usable .message still degrades to the fallback, never an object
    expect(toErrorMessage({ response: { data: { detail: { code: 7 } } } }, "fallback")).toBe("fallback");
  });
});

// M-11 regression: getResearchStatus must mirror _pollResearch's 404-only
// "gone" check. Before the fix, a bare `catch { return {state:'gone'} }`
// misreported ANY failure (network blip, 500, timeout) as a permanently
// deleted job — a real correctness bug since "gone" drives a different UI
// path (silently drop the stale id) than a transient/unknown failure should.
describe("getResearchStatus (M-11)", () => {
  const origAdapter = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = origAdapter;
  });

  const rejectWith = (status: number | undefined) => (config: unknown) =>
    Promise.reject(
      new AxiosError(
        "boom",
        status === undefined ? "ERR_NETWORK" : "ERR_BAD_REQUEST",
        config as never,
        null,
        status === undefined
          ? undefined
          : ({ status, statusText: "err", headers: {}, config: config as never, data: null } as never),
      ),
    );

  it("returns state:'gone' on an actual 404", async () => {
    api.defaults.adapter = rejectWith(404) as never;
    await expect(getResearchStatus("job-1")).resolves.toEqual({ state: "gone" });
  });

  it("does NOT return state:'gone' on a 500 — surfaces it as an error instead", async () => {
    api.defaults.adapter = rejectWith(500) as never;
    const result = await getResearchStatus("job-1").catch((e) => ({ threw: true, e }));
    expect(result).not.toEqual({ state: "gone" });
    expect((result as { threw?: boolean }).threw).toBe(true);
  });

  it("does NOT return state:'gone' on a network error with no response — surfaces it as an error instead", async () => {
    api.defaults.adapter = rejectWith(undefined) as never;
    const result = await getResearchStatus("job-1").catch((e) => ({ threw: true, e }));
    expect(result).not.toEqual({ state: "gone" });
    expect((result as { threw?: boolean }).threw).toBe(true);
  });
});

// M-12 regression: a partial batch (some URLs succeed, some don't) used to
// silently drop which ones failed — the caller could only see the successes,
// with zero signal that 2 of 5 pasted URLs never made it in.
describe("edgarVaultUrls (M-12)", () => {
  const origAdapter = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = origAdapter;
  });

  const byUrl = (behavior: Record<string, "ok" | number>) => (config: { data?: string }) => {
    const body = JSON.parse(config.data || "{}") as { exhibit_url: string };
    const outcome = behavior[body.exhibit_url];
    if (outcome === "ok") {
      return Promise.resolve({
        data: {
          document_id: `d-${body.exhibit_url}`, storage_key: "k", doc_type: "EDGAR Exhibit",
          run_mode: "legal", chunks_created: 1, provenance: "primary · vaulted", message: "ok",
        },
        status: 200, statusText: "OK", headers: {}, config: config as never,
      });
    }
    return Promise.reject(
      new AxiosError("boom", "ERR_BAD_REQUEST", config as never, null,
        { status: outcome as number, statusText: "err", headers: {}, config: config as never, data: null } as never),
    );
  };

  it("all URLs succeed: ok has all, failed is empty", async () => {
    api.defaults.adapter = byUrl({ "u/a": "ok", "u/b": "ok" }) as never;
    const res = await edgarVaultUrls("i1", "u/a,u/b");
    expect(res.ok.length).toBe(2);
    expect(res.failed).toEqual([]);
  });

  it("partial failure: ok has the successes, failed names the rest with a reason", async () => {
    api.defaults.adapter = byUrl({ "u/a": "ok", "u/b": 404 }) as never;
    const res = await edgarVaultUrls("i1", "u/a,u/b");
    expect(res.ok.length).toBe(1);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].url).toBe("u/b");
    expect(res.failed[0].reason).toBeTruthy();
  });

  it("all URLs fail: still throws (unchanged all-fail behavior)", async () => {
    api.defaults.adapter = byUrl({ "u/a": 503, "u/b": 503 }) as never;
    await expect(edgarVaultUrls("i1", "u/a,u/b")).rejects.toBeTruthy();
  });
});

describe("updateAnalystWorkspace concurrency", () => {
  const origAdapter = api.defaults.adapter;
  afterEach(() => { api.defaults.adapter = origAdapter; });

  it("replays the workspace function on the authoritative 409 base", async () => {
    let patchCalls = 0;
    let replayBody: Record<string, unknown> | null = null;
    const remote = {
      model_lanes: {}, email_intelligence: {}, revision: 8,
      workspace: { concurrent_surface: { preserved: true } },
    };
    api.defaults.adapter = (async (config: { method?: string; data?: unknown }) => {
      if (config.method === "get") {
        return { data: { model_lanes: {}, email_intelligence: {}, revision: 7, workspace: {} }, status: 200, statusText: "OK", headers: {}, config: config as never };
      }
      patchCalls += 1;
      if (patchCalls === 1) {
        throw new AxiosError("conflict", "ERR_BAD_REQUEST", config as never, null, {
          status: 409, statusText: "Conflict", headers: {}, config: config as never,
          data: { detail: { message: "Settings changed elsewhere.", current: remote } },
        });
      }
      replayBody = JSON.parse(String(config.data)) as Record<string, unknown>;
      return {
        data: { ...remote, workspace: replayBody.workspace, revision: 9 },
        status: 200, statusText: "OK", headers: {}, config: config as never,
      };
    }) as never;

    const saved = await updateAnalystWorkspace((workspace) => ({
      ...workspace,
      model_checkpoints: { issuer: ["new"] },
    }));

    expect(patchCalls).toBe(2);
    expect(replayBody).toMatchObject({
      expected_revision: 8,
      workspace: {
        concurrent_surface: { preserved: true },
        model_checkpoints: { issuer: ["new"] },
      },
    });
    expect(saved.workspace?.concurrent_surface).toEqual({ preserved: true });
  });
});
