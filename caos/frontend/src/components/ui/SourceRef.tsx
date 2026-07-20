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

const LOCAL_SOURCE_BASE = "https://caos.invalid";

function safeSourceHref(raw: string): string | null {
  // Keep the rendered href byte-for-byte identical once accepted. Reject URL
  // forms whose browser interpretation can change after trimming or slash
  // normalization rather than trying to repair an untrusted source reference.
  if (!raw || /[\s\\]/u.test(raw) || raw.startsWith("//")) return null;

  try {
    if (raw.startsWith("/")) {
      const parsed = new URL(raw, LOCAL_SOURCE_BASE);
      return parsed.origin === LOCAL_SOURCE_BASE ? raw : null;
    }
    if (!/^https?:\/\//iu.test(raw)) return null;
    const parsed = new URL(raw);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
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
  if ("href" in source && typeof source.href === "string") {
    const href = safeSourceHref(source.href);
    if (!href) {
      return <span className={`${classes} text-caos-muted`}>Source unavailable · Source {source.id} has an invalid destination.</span>;
    }
    return <a href={href} className={`${classes} rounded text-caos-muted hover:text-caos-accent transition-caos focus-ring`} aria-label={ariaLabel}>{label}</a>;
  }
  return <button type="button" className={`${classes} rounded text-caos-muted hover:text-caos-accent transition-caos focus-ring`} onClick={source.onOpen} aria-label={ariaLabel}>{label}</button>;
}
