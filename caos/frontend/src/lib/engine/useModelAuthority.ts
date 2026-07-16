import { useEffect, useMemo, useState } from "react";
import {
  getModelV2,
  getSettings,
  type WorkspaceSettings,
} from "@/lib/api";
import type {
  ModelV2Calculation,
  ModelV2ReadResponse,
} from "@/lib/engine/modelV2";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";

export type ModelAuthorityFailReason =
  | "authority-loading"
  | "authority-unknown"
  | "authority-read-error"
  | "v2-read-error"
  | "legacy-reference-only"
  | "legacy-calculation-error";

export interface LegacyModelAuthority<TLegacy> {
  mode: "legacy-confirmed";
  capability: "legacy";
  legacy: TLegacy;
}

export interface V2ModelAuthority {
  mode: "v2-confirmed";
  capability: "v2";
  response: ModelV2ReadResponse;
  /** Saved calculation first, otherwise the server-produced suggestion. */
  calculation: ModelV2Calculation | null;
}

export interface FailClosedModelAuthority {
  mode: "fail-closed";
  capability: "unknown" | "legacy" | "v2";
  reason: ModelAuthorityFailReason;
  error: Error | null;
}

export type ModelAuthorityState<TLegacy> =
  | LegacyModelAuthority<TLegacy>
  | V2ModelAuthority
  | FailClosedModelAuthority;

type ModelCapabilitySettings = Pick<WorkspaceSettings, "features">;

export interface ModelAuthorityReaders {
  readWorkspaceSettings: () => Promise<ModelCapabilitySettings>;
  readModelV2: (issuerId: string, exactRunId?: string) => Promise<ModelV2ReadResponse>;
}

export interface ResolveModelAuthorityOptions<TLegacy> {
  issuerId: string;
  exactRunId?: string | null;
  buildLegacyModel: () => TLegacy;
  readers?: ModelAuthorityReaders;
}

const defaultReaders: ModelAuthorityReaders = {
  readWorkspaceSettings: getSettings,
  readModelV2: getModelV2,
};

function failClosed(
  reason: ModelAuthorityFailReason,
  capability: FailClosedModelAuthority["capability"],
  error: Error | null = null,
): FailClosedModelAuthority {
  return { mode: "fail-closed", capability, reason, error };
}

function asError(reason: unknown, fallback: string): Error {
  return reason instanceof Error ? reason : new Error(fallback);
}

/**
 * Resolve the single calculation authority for a model surface.
 *
 * The reference TypeScript calculator is deliberately reachable only for the
 * explicit Atlas Forge reference issuer, independent of rollout state. A live
 * issuer uses V2 only when explicitly enabled; flag-off, missing/malformed
 * settings, settings failures, and every V2 failure remain fail-closed.
 */
export async function resolveModelAuthority<TLegacy>({
  issuerId,
  exactRunId,
  buildLegacyModel,
  readers = defaultReaders,
}: ResolveModelAuthorityOptions<TLegacy>): Promise<ModelAuthorityState<TLegacy>> {
  if (!issuerId) return failClosed("authority-unknown", "unknown");

  let settings: ModelCapabilitySettings;
  try {
    settings = await readers.readWorkspaceSettings();
  } catch (reason) {
    return failClosed(
      "authority-read-error",
      "unknown",
      asError(reason, "Unable to resolve model calculation authority."),
    );
  }

  // Deliberately validate the runtime payload instead of treating an absent
  // capability as false during mixed-version deploys.
  const features = (
    settings as {
      features?: {
        model_engine_v2?: unknown;
        model_engine_v2_enabled?: unknown;
      };
    }
  ).features;
  const enabled = typeof features?.model_engine_v2 === "boolean"
    ? features.model_engine_v2
    : features?.model_engine_v2_enabled;
  if (typeof enabled !== "boolean") {
    return failClosed("authority-unknown", "unknown");
  }

  // Atlas Forge is the one explicit synthetic reference surface. It remains
  // on the TypeScript reference calculator in either rollout state and cannot
  // be mistaken for a live Model Engine v2 issuer.
  if (issuerId === ATLF_REFERENCE_ISSUER_ID) {
    try {
      return {
        mode: "legacy-confirmed",
        capability: "legacy",
        legacy: buildLegacyModel(),
      };
    } catch (reason) {
      return failClosed(
        "legacy-calculation-error",
        "legacy",
        asError(reason, "The legacy reference calculator failed."),
      );
    }
  }

  if (!enabled) {
    // Never let a disabled feature flag turn the synthetic fixture calculator
    // into calculation authority for a live issuer.
    return failClosed("legacy-reference-only", "legacy");
  }

  try {
    const response = exactRunId
      ? await readers.readModelV2(issuerId, exactRunId)
      : await readers.readModelV2(issuerId);
    if (response.authority !== "model-engine-v2") {
      return failClosed("authority-unknown", "v2");
    }
    return {
      mode: "v2-confirmed",
      capability: "v2",
      response,
      calculation: response.current_calculation
        ?? response.record?.calculation
        ?? response.suggested_calculation,
    };
  } catch (reason) {
    return failClosed(
      "v2-read-error",
      "v2",
      asError(reason, "Model Engine v2 is unavailable."),
    );
  }
}

export interface UseModelAuthorityOptions<TLegacy> {
  issuerId: string;
  exactRunId?: string | null;
  /** Keep this callback stable with useCallback; changing it re-resolves authority. */
  buildLegacyModel: () => TLegacy;
}

export function useModelAuthority<TLegacy>({
  issuerId,
  exactRunId,
  buildLegacyModel,
}: UseModelAuthorityOptions<TLegacy>): ModelAuthorityState<TLegacy> {
  const scopeKey = JSON.stringify([issuerId, exactRunId ?? null]);
  const loadingState = useMemo<ModelAuthorityState<TLegacy>>(
    () => failClosed("authority-loading", "unknown"),
    [],
  );
  const [resolved, setResolved] = useState<{
    scopeKey: string;
    state: ModelAuthorityState<TLegacy>;
  }>(() => ({ scopeKey, state: loadingState }));

  useEffect(() => {
    let active = true;
    setResolved({ scopeKey, state: loadingState });
    void resolveModelAuthority({ issuerId, exactRunId, buildLegacyModel }).then((resolved) => {
      if (active) setResolved({ scopeKey, state: resolved });
    });
    return () => {
      active = false;
    };
  }, [buildLegacyModel, exactRunId, issuerId, loadingState, scopeKey]);

  // Effects run after render. Scope the stored result during render itself so
  // an A response is never paired with B's issuer prop for even one frame.
  return resolved.scopeKey === scopeKey ? resolved.state : loadingState;
}
