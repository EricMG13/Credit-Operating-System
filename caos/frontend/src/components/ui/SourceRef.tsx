"use client";

import type { ReactNode } from "react";

export type ReadySourceRef = {
  state: "ready";
  /** Persisted evidence, document, or source identifier — never a display-only label. */
  id: string;
  /** A real destination for the persisted source. Mutually exclusive with onOpen. */
  href: string;
  onOpen?: never;
};

export type ReadySourceRefAction = {
  state: "ready";
  /** Persisted evidence, document, or source identifier — never a display-only label. */
  id: string;
  /** A real action for the persisted source. Mutually exclusive with href. */
  onOpen: () => void;
  href?: never;
};

export type UnavailableSourceRef = {
  state: "unavailable";
  /** Explains the missing identifier or missing route without suggesting a source exists. */
  reason: string;
};

export type SourceRefState = ReadySourceRef | ReadySourceRefAction | UnavailableSourceRef;

export interface SourceRefProps {
  source: SourceRefState;
  /** Visible label for a ready source. The persisted id remains in the accessible name. */
  children?: ReactNode;
  className?: string;
}

/**
 * An evidence affordance with an honesty boundary: ready is clickable only when
 * the payload carries both a persisted identifier and a concrete route/action.
 * Missing provenance is deliberately text, never an inert link or source-like chip.
 */
export function SourceRef({ source, children, className = "" }: SourceRefProps) {
  const classes = `tabular text-caos-2xs${className ? ` ${className}` : ""}`;
  if (source.state === "unavailable") {
    return <span className={`${classes} text-caos-muted`}>Source unavailable · {source.reason}</span>;
  }

  const label = children ?? `Source ${source.id}`;
  const ariaLabel = `Open source ${source.id}`;
  if ("href" in source) {
    return <a href={source.href} className={`${classes} rounded text-caos-muted hover:text-caos-accent transition-caos focus-ring`} aria-label={ariaLabel}>{label}</a>;
  }
  return <button type="button" className={`${classes} rounded text-caos-muted hover:text-caos-accent transition-caos focus-ring`} onClick={source.onOpen} aria-label={ariaLabel}>{label}</button>;
}
