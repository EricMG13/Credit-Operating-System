// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { AxiosError } from "axios";
import { api } from "./api";

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
