import { describe, expect, it, vi } from "vitest";
import type { ModelV2Calculation, ModelV2ReadResponse } from "./modelV2";
import {
  resolveModelAuthority,
  type ModelAuthorityReaders,
} from "./useModelAuthority";
import { ATLF_REFERENCE_ISSUER_ID } from "./types";

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
