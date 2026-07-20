// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModelV2Calculation, ModelV2ReadResponse } from "./modelV2";
import {
  resolveModelAuthority,
  useModelAuthority,
  type ModelAuthorityReaders,
} from "./useModelAuthority";
import { ATLF_REFERENCE_ISSUER_ID } from "./types";
import { getModelV2, getSettings } from "@/lib/api";

vi.mock("@/lib/api", () => ({ getSettings: vi.fn(), getModelV2: vi.fn() }));

const v2Response: ModelV2ReadResponse = {
  authority: "model-engine-v2",
  record: null,
  suggested_payload: null,
  suggested_calculation: null,
  suggested_source_run_id: null,
  current_calculation: null,
  requires_recalculation: false,
  availability: "unavailable",
  detail: "No completed owned issuer run is available.",
};

function readersFor(enabled: boolean): ModelAuthorityReaders {
  return {
    readWorkspaceSettings: vi.fn(async () => ({
      features: {
        lineage_v2_enabled: true,
        market_xlsx_v2_enabled: true,
        model_engine_v2_enabled: enabled,
      },
    })),
    readModelV2: vi.fn(async () => v2Response),
  };
}

describe("resolveModelAuthority", () => {
  it("fails closed before reading settings when issuer identity is absent", async () => {
    const readers = readersFor(true);
    const result = await resolveModelAuthority({ issuerId: "", buildLegacyModel: vi.fn(), readers });

    expect(result).toMatchObject({ mode: "fail-closed", reason: "authority-unknown" });
    expect(readers.readWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("allows the reference calculator only when legacy authority is explicitly confirmed", async () => {
    const buildLegacyModel = vi.fn(() => ({ source: "typescript-reference" }));
    const readers = readersFor(false);

    const result = await resolveModelAuthority({
      issuerId: ATLF_REFERENCE_ISSUER_ID,
      buildLegacyModel,
      readers,
    });

    expect(result).toEqual({
      mode: "legacy-confirmed",
      capability: "legacy",
      legacy: { source: "typescript-reference" },
    });
    expect(buildLegacyModel).toHaveBeenCalledOnce();
    expect(readers.readModelV2).not.toHaveBeenCalled();
  });

  it("never exposes the reference calculator to a live issuer when v2 is disabled", async () => {
    const buildLegacyModel = vi.fn(() => ({ source: "typescript-reference" }));
    const readers = readersFor(false);

    const result = await resolveModelAuthority({
      issuerId: "issuer-live",
      buildLegacyModel,
      readers,
    });

    expect(result).toMatchObject({
      mode: "fail-closed",
      capability: "legacy",
      reason: "legacy-reference-only",
    });
    expect(buildLegacyModel).not.toHaveBeenCalled();
    expect(readers.readModelV2).not.toHaveBeenCalled();
  });

  it("keeps Atlas Forge on the explicit reference calculator when v2 is enabled", async () => {
    const buildLegacyModel = vi.fn(() => ({ source: "typescript-reference" }));
    const readers = readersFor(true);

    const result = await resolveModelAuthority({
      issuerId: ATLF_REFERENCE_ISSUER_ID,
      buildLegacyModel,
      readers,
    });

    expect(result).toEqual({
      mode: "legacy-confirmed",
      capability: "legacy",
      legacy: { source: "typescript-reference" },
    });
    expect(buildLegacyModel).toHaveBeenCalledOnce();
    expect(readers.readModelV2).not.toHaveBeenCalled();
  });

  it("converts a non-Error legacy calculator failure into the safe fallback error", async () => {
    const result = await resolveModelAuthority({
      issuerId: ATLF_REFERENCE_ISSUER_ID,
      buildLegacyModel: () => { throw "legacy failed"; },
      readers: readersFor(false),
    });

    expect(result).toMatchObject({
      mode: "fail-closed",
      capability: "legacy",
      reason: "legacy-calculation-error",
      error: new Error("The legacy reference calculator failed."),
    });
  });

  it("fails closed when the capability is absent", async () => {
    const buildLegacyModel = vi.fn();
    const readModelV2 = vi.fn(async () => v2Response);

    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      buildLegacyModel,
      readers: {
        readWorkspaceSettings: vi.fn(async () => ({} as never)),
        readModelV2,
      },
    });

    expect(result).toMatchObject({
      mode: "fail-closed",
      capability: "unknown",
      reason: "authority-unknown",
    });
    expect(buildLegacyModel).not.toHaveBeenCalled();
    expect(readModelV2).not.toHaveBeenCalled();
  });

  it("uses only the server response when v2 authority is confirmed", async () => {
    const buildLegacyModel = vi.fn();
    const readers = readersFor(true);

    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      buildLegacyModel,
      readers,
    });

    expect(result).toMatchObject({
      mode: "v2-confirmed",
      capability: "v2",
      response: v2Response,
      calculation: null,
    });
    expect(readers.readModelV2).toHaveBeenCalledWith("issuer-1");
    expect(buildLegacyModel).not.toHaveBeenCalled();
  });

  it("prefers the canonical capability field when both rollout keys are present", async () => {
    const readers: ModelAuthorityReaders = {
      readWorkspaceSettings: vi.fn(async () => ({
        features: { model_engine_v2: true, model_engine_v2_enabled: false },
      } as never)),
      readModelV2: vi.fn(async () => v2Response),
    };

    const result = await resolveModelAuthority({ issuerId: "issuer-1", buildLegacyModel: vi.fn(), readers });
    expect(result.mode).toBe("v2-confirmed");
  });

  it("fails closed when the server does not affirm v2 authority", async () => {
    const readers = readersFor(true);
    vi.mocked(readers.readModelV2).mockResolvedValue({ ...v2Response, authority: "unknown" } as unknown as ModelV2ReadResponse);

    const result = await resolveModelAuthority({ issuerId: "issuer-1", buildLegacyModel: vi.fn(), readers });
    expect(result).toMatchObject({ mode: "fail-closed", capability: "v2", reason: "authority-unknown" });
  });

  it("passes an exact run identity to the v2 authority read", async () => {
    const readers = readersFor(true);

    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      exactRunId: "run-exact",
      buildLegacyModel: vi.fn(),
      readers,
    });

    expect(result.mode).toBe("v2-confirmed");
    expect(readers.readModelV2).toHaveBeenCalledWith("issuer-1", "run-exact");
  });

  it("selects the server's current calculation when a saved revision requires recalculation", async () => {
    const current = { calculation_hash: "current" } as ModelV2Calculation;
    const readers = readersFor(true);
    vi.mocked(readers.readModelV2).mockResolvedValue({
      ...v2Response,
      current_calculation: current,
      requires_recalculation: true,
    });

    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      buildLegacyModel: vi.fn(),
      readers,
    });

    expect(result).toMatchObject({
      mode: "v2-confirmed",
      calculation: current,
    });
  });

  it("falls through to the saved record calculation before the suggestion", async () => {
    const saved = { calculation_hash: "saved" } as ModelV2Calculation;
    const readers = readersFor(true);
    vi.mocked(readers.readModelV2).mockResolvedValue({
      ...v2Response,
      record: { calculation: saved } as ModelV2ReadResponse["record"],
      suggested_calculation: { calculation_hash: "suggested" } as ModelV2Calculation,
    });

    const result = await resolveModelAuthority({ issuerId: "issuer-1", buildLegacyModel: vi.fn(), readers });
    expect(result).toMatchObject({ mode: "v2-confirmed", calculation: saved });
  });

  it("does not fall back when the authority request errors", async () => {
    const buildLegacyModel = vi.fn();
    const readModelV2 = vi.fn(async () => v2Response);

    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      buildLegacyModel,
      readers: {
        readWorkspaceSettings: vi.fn(async () => {
          throw new Error("settings unavailable");
        }),
        readModelV2,
      },
    });

    expect(result).toMatchObject({
      mode: "fail-closed",
      capability: "unknown",
      reason: "authority-read-error",
    });
    expect(buildLegacyModel).not.toHaveBeenCalled();
    expect(readModelV2).not.toHaveBeenCalled();
  });

  it("uses the safe authority message for a non-Error settings rejection", async () => {
    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      buildLegacyModel: vi.fn(),
      readers: {
        readWorkspaceSettings: vi.fn(async () => { throw "offline"; }),
        readModelV2: vi.fn(async () => v2Response),
      },
    });

    expect(result).toMatchObject({
      mode: "fail-closed",
      reason: "authority-read-error",
      error: new Error("Unable to resolve model calculation authority."),
    });
  });

  it("does not fall back when the confirmed v2 read errors", async () => {
    const buildLegacyModel = vi.fn();
    const readers = readersFor(true);
    vi.mocked(readers.readModelV2).mockRejectedValue(new Error("v2 unavailable"));

    const result = await resolveModelAuthority({
      issuerId: "issuer-1",
      buildLegacyModel,
      readers,
    });

    expect(result).toMatchObject({
      mode: "fail-closed",
      capability: "v2",
      reason: "v2-read-error",
    });
    expect(buildLegacyModel).not.toHaveBeenCalled();
  });
});

describe("useModelAuthority", () => {
  it("loads through the default readers and never publishes a stale issuer response", async () => {
    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => { resolve = done; });
      return { promise, resolve };
    };
    const issuerA = deferred<ModelV2ReadResponse>();
    const issuerB = deferred<ModelV2ReadResponse>();
    vi.mocked(getSettings).mockResolvedValue({
      features: { model_engine_v2: true },
    } as never);
    vi.mocked(getModelV2).mockImplementation((issuerId) => issuerId === "issuer-a" ? issuerA.promise : issuerB.promise);
    const buildLegacyModel = vi.fn(() => ({ source: "legacy" }));
    const { result, rerender, unmount } = renderHook(
      ({ issuerId, exactRunId }: { issuerId: string; exactRunId: string | null }) => useModelAuthority({ issuerId, exactRunId, buildLegacyModel }),
      { initialProps: { issuerId: "issuer-a", exactRunId: "run-a" } as { issuerId: string; exactRunId: string | null } },
    );

    expect(result.current).toMatchObject({ mode: "fail-closed", reason: "authority-loading" });
    await waitFor(() => expect(getModelV2).toHaveBeenCalledWith("issuer-a", "run-a"));

    rerender({ issuerId: "issuer-b", exactRunId: null });
    expect(result.current).toMatchObject({ mode: "fail-closed", reason: "authority-loading" });
    await waitFor(() => expect(getModelV2).toHaveBeenCalledWith("issuer-b"));

    await act(async () => { issuerB.resolve({ ...v2Response, detail: "issuer-b" }); });
    await waitFor(() => expect(result.current).toMatchObject({ mode: "v2-confirmed", response: { detail: "issuer-b" } }));

    await act(async () => { issuerA.resolve({ ...v2Response, detail: "late issuer-a" }); });
    expect(result.current).toMatchObject({ mode: "v2-confirmed", response: { detail: "issuer-b" } });
    expect(buildLegacyModel).not.toHaveBeenCalled();
    unmount();
  });
});
