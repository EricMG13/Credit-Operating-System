// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { AxiosError } from "axios";
import { api, getIssuers } from "./api";

// SEAM4-1: the response interceptor must fire caos:auth-lost on a 401 from a real
// endpoint (so AuthProvider re-resolves → login landing), but NOT for the /me
// probe (AuthProvider owns that result — a self-trigger would loop).
const orig = api.defaults.adapter;
// Force every request to reject with a 401, regardless of URL.
const reject401 = (config: unknown) =>
  Promise.reject(new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config as never, null, {
    status: 401, statusText: "Unauthorized", headers: {}, config: config as never, data: null,
  }));

beforeEach(() => { api.defaults.adapter = reject401 as never; });
afterEach(() => { api.defaults.adapter = orig; vi.restoreAllMocks(); });

describe("api 401 interceptor (SEAM4-1)", () => {
  it("dispatches caos:auth-lost on a 401 from a normal endpoint, and re-throws", async () => {
    const spy = vi.fn();
    window.addEventListener("caos:auth-lost", spy);
    await expect(api.get("/api/runs")).rejects.toBeTruthy(); // error still propagates
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener("caos:auth-lost", spy);
  });

  it("does NOT dispatch for the /api/auth/me probe (avoids a self-trigger loop)", async () => {
    const spy = vi.fn();
    window.addEventListener("caos:auth-lost", spy);
    await expect(api.get("/api/auth/me")).rejects.toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener("caos:auth-lost", spy);
  });
});

describe("api shape guards", () => {
  it("rejects non-array issuer responses", async () => {
    api.defaults.adapter = ((config: unknown) => Promise.resolve({
      status: 200,
      statusText: "OK",
      headers: {},
      config: config as never,
      data: { detail: "not an issuer list" },
    })) as never;

    await expect(getIssuers()).rejects.toThrow("Invalid issuer response");
  });
});

describe("api CSRF interceptor", () => {
  it("copies the double-submit cookie into unsafe same-origin requests", async () => {
    document.cookie = "caos_csrf=bound-token; Path=/";
    let csrfHeader: string | undefined;
    api.defaults.adapter = ((config: { headers: { get(name: string): string | undefined } }) => {
      csrfHeader = config.headers.get("X-CSRF-Token");
      return Promise.resolve({
        status: 200, statusText: "OK", headers: {}, config: config as never, data: {},
      });
    }) as never;

    await api.post("/api/runs", {});
    expect(csrfHeader).toBe("bound-token");
    document.cookie = "caos_csrf=; Max-Age=0; Path=/";
  });
});

// M-13a regression: the request interceptor reads localStorage (loadMode() +
// the caos_query_model key) with no guard. In a browser with localStorage
// disabled/full/blocked (private-mode Safari, some corporate policies), a
// throwing read must not break every single API call's interceptor.
describe("api request interceptor — localStorage resilience (M-13a)", () => {
  it("does not break the request when localStorage.getItem throws", async () => {
    // jsdom's window.localStorage instance ignores a per-instance method
    // override — spy on Storage.prototype so the throw actually reaches the
    // interceptor's read.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (key: string) {
      if (key === "caos_query_model") throw new DOMException("blocked", "SecurityError");
      return null;
    });
    api.defaults.adapter = ((config: unknown) =>
      Promise.resolve({
        status: 200,
        statusText: "OK",
        headers: {},
        config: config as never,
        data: [],
      })) as never;

    await expect(api.get("/api/runs")).resolves.toBeTruthy();
  });
});
