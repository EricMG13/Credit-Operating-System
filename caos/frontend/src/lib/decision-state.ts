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
