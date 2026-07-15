import { useEffect, useState } from "react";
import {
  getContextFreshness,
  getIssuerFreshness,
  getRunFreshness,
  type ContextFreshnessResponse,
  type IssuerFreshnessResponse,
  type RunFreshnessResponse,
} from "@/lib/api";

export type FreshnessReadStatus = "idle" | "loading" | "ready" | "compatibility-unavailable" | "error";

export interface FreshnessReadState {
  issuer: IssuerFreshnessResponse | null;
  context: ContextFreshnessResponse | null;
  run: RunFreshnessResponse | null;
  issuerStatus: FreshnessReadStatus;
  contextStatus: FreshnessReadStatus;
  runStatus: FreshnessReadStatus;
  contextRequested: boolean;
  loading: boolean;
  compatibilityUnavailable: boolean;
  error: boolean;
  /** Compatibility alias retained for existing consumers. */
  unavailable: boolean;
}

const statusFor = (requested: boolean): FreshnessReadStatus => requested ? "loading" : "idle";

function compatibilityUnavailable(reason: unknown): boolean {
  return (reason as { response?: { status?: unknown } })?.response?.status === 404;
}

async function readFreshness<T>(requested: boolean, read: () => Promise<T>): Promise<{ value: T | null; status: FreshnessReadStatus }> {
  if (!requested) return { value: null, status: "idle" };
  try {
    return { value: await read(), status: "ready" };
  } catch (reason) {
    return {
      value: null,
      status: compatibilityUnavailable(reason) ? "compatibility-unavailable" : "error",
    };
  }
}

export function useIssuerFreshness({ issuerId, contextId, runId, artifactRevision }: {
  issuerId?: string | null;
  contextId?: string | null;
  runId?: string | null;
  /** Changes when the same context/run binds a different exact artifact. */
  artifactRevision?: string | number | null;
}): FreshnessReadState {
  const [state, setState] = useState<FreshnessReadState>({
    issuer: null, context: null, run: null,
    issuerStatus: "idle", contextStatus: "idle", runStatus: "idle",
    contextRequested: false,
    loading: false, compatibilityUnavailable: false, error: false, unavailable: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const issuerRequested = Boolean(issuerId);
    const contextRequested = Boolean(contextId);
    const runRequested = Boolean(runId);
    const anyRequested = issuerRequested || contextRequested || runRequested;
    setState({
      issuer: null, context: null, run: null,
      issuerStatus: statusFor(issuerRequested),
      contextStatus: statusFor(contextRequested),
      runStatus: statusFor(runRequested),
      contextRequested,
      loading: anyRequested, compatibilityUnavailable: false, error: false, unavailable: false,
    });
    const issuerRead = readFreshness(issuerRequested, () => getIssuerFreshness(issuerId!, controller.signal));
    const contextRead = readFreshness(contextRequested, () => getContextFreshness(contextId!, controller.signal));
    const runRead = readFreshness(runRequested, () => getRunFreshness(runId!, controller.signal));
    Promise.all([issuerRead, contextRead, runRead]).then(([issuer, context, run]) => {
      if (!active) return;
      const requestedStatuses = [
        issuerRequested ? issuer.status : null,
        contextRequested ? context.status : null,
        runRequested ? run.status : null,
      ].filter((status): status is FreshnessReadStatus => status !== null);
      const onlyCompatibilityUnavailable = requestedStatuses.length > 0
        && requestedStatuses.every((status) => status === "compatibility-unavailable");
      setState({
        issuer: issuer.value, context: context.value, run: run.value,
        issuerStatus: issuer.status, contextStatus: context.status, runStatus: run.status,
        contextRequested,
        loading: false,
        compatibilityUnavailable: requestedStatuses.includes("compatibility-unavailable"),
        error: requestedStatuses.includes("error"),
        unavailable: onlyCompatibilityUnavailable,
      });
    });
    return () => { active = false; controller.abort(); };
  }, [artifactRevision, contextId, issuerId, runId]);
  return state;
}

export function derivedFreshness(state: FreshnessReadState, artifactId?: string | null) {
  // Context is the preferred exact-artifact authority. If that read failed or
  // the compatibility endpoint is absent, a CURRENT run must not mask the
  // uncertainty. Callers render null as UNKNOWN.
  if (artifactId) {
    if (!state.contextRequested || state.contextStatus !== "ready") return null;
    return state.context?.artifacts.find((item) =>
      item.evaluation.source_kind === "derived_artifact" && item.artifact.id === artifactId,
    )?.evaluation ?? null;
  }
  if (state.contextRequested && state.contextStatus !== "ready") return null;
  return state.run?.evaluation
    ?? state.issuer?.evaluations.find((item) => item.source_kind === "derived_artifact")
    ?? state.issuer?.evaluations.find((item) => item.source_kind === "run")
    ?? null;
}
