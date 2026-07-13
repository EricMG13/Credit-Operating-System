import type { ReactNode } from "react";
import type { Provenance } from "./provenance";

export type ApprovalState = "UNRATIFIED" | "RATIFIED" | "CONDITIONAL" | "DRAFT";

export interface DecisionAuthority {
  provenance: Provenance;
  approval?: ApprovalState;
}

interface TimestampedState {
  /** Display-ready observation timestamp. Successful conclusions must carry it. */
  asOf: string;
  authority?: DecisionAuthority;
}

export type DecisionDatumState =
  | ({ kind: "ready"; value: ReactNode } & TimestampedState)
  | ({ kind: "observed-empty"; message?: string } & TimestampedState)
  | ({ kind: "stale"; value: ReactNode; staleSince?: string } & TimestampedState)
  | ({ kind: "partial"; value?: ReactNode; missingSources: string[] } & TimestampedState)
  | { kind: "loading"; message?: string }
  | { kind: "offline"; lastKnown?: ReactNode; lastKnownAt?: string; retryLabel?: string; onRetry?: () => void }
  | { kind: "error"; message: string; retryLabel?: string; onRetry?: () => void; escalationLabel?: string; onEscalate?: () => void }
  | { kind: "unavailable"; message?: string };

export interface DecisionContextState {
  whatChanged: DecisionDatumState;
  whyItMatters: DecisionDatumState;
  requiredAction: DecisionDatumState;
  evidenceHealth: DecisionDatumState;
}

export function ready(
  value: ReactNode,
  asOf: string,
  authority?: DecisionAuthority,
): DecisionDatumState {
  return { kind: "ready", value, asOf, authority };
}

export function observedEmpty(
  asOf: string,
  authority?: DecisionAuthority,
  message = "No material change observed",
): DecisionDatumState {
  return { kind: "observed-empty", message, asOf, authority };
}

export const unavailableDecisionContext = (): DecisionContextState => ({
  whatChanged: { kind: "unavailable", message: "Change observation unavailable" },
  whyItMatters: { kind: "unavailable", message: "Decision impact unavailable" },
  requiredAction: { kind: "unavailable", message: "Required action unavailable" },
  evidenceHealth: { kind: "unavailable", message: "Evidence state unavailable" },
});
