// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { api } from "./api";

const originalAdapter = api.defaults.adapter;

function rejectUnauthorized(config: unknown) {
  return Promise.reject(new AxiosError(
    "unauthorized",
    "ERR_BAD_REQUEST",
    config as never,
    null,
    {
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config: config as never,
      data: { detail: "unauthorized" },
    } as never,
  ));
}

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

describe("global auth-loss response handling", () => {
  it.each([
    "/api/auth/profile",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/recover",
  ])("leaves an expected credential-entry 401 with its form for %s", async (url) => {
    api.defaults.adapter = rejectUnauthorized as never;
    const onLost = vi.fn();
    window.addEventListener("caos:auth-lost", onLost);

    await expect(api.post(url, {})).rejects.toBeTruthy();

    expect(onLost).not.toHaveBeenCalled();
    window.removeEventListener("caos:auth-lost", onLost);
  });

  it("still dispatches auth-lost for a protected API 401", async () => {
    api.defaults.adapter = rejectUnauthorized as never;
    const onLost = vi.fn();
    window.addEventListener("caos:auth-lost", onLost);

    await expect(api.get("/api/issuers")).rejects.toBeTruthy();

    expect(onLost).toHaveBeenCalledTimes(1);
    window.removeEventListener("caos:auth-lost", onLost);
  });

  it("does not turn the profile POST exception into a broad auth-prefix exception", async () => {
    api.defaults.adapter = rejectUnauthorized as never;
    const onLost = vi.fn();
    window.addEventListener("caos:auth-lost", onLost);

    await expect(api.delete("/api/auth/profile")).rejects.toBeTruthy();

    expect(onLost).toHaveBeenCalledTimes(1);
    window.removeEventListener("caos:auth-lost", onLost);
  });
});
