"use client";

import { useEffect, useState } from "react";
import { MoreDrawer } from "./MoreDrawer";

/**
 * The 40px sub-header strip every concept page wears. Replaces the hand-rolled
 * bars that were copy-pasted across all ten surfaces.
 *
 * Layout (≥1280px):
 *   [identity ................ contextualControls ... primaryAction]
 *
 * Layout (<1280px):
 *   [identity ................ ⋯ More ... primaryAction]
 *   where ⋯ More opens a popover with contextualControls.
 *
 * The caller composes `identity` — SubHeader does NOT bake in the back-link or
 * ConceptNav. This lets surfaces with different identity needs (Issuer Profile
 * overlay, Query, the hub) use the same component.
 */
export function SubHeader({
  identity,
  primaryAction,
  contextualControls,
  className = "",
  "aria-label": ariaLabel,
}: {
  /** Identity that survives every breakpoint: back-link + concept nav + issuer/run/deal label. */
  identity: React.ReactNode;
  /** The ONE primary action for this concept (SAVE MODEL, EXPORT PDF, ASK, INTAKE, → MONITOR). */
  primaryAction?: React.ReactNode;
  /** Contextual controls. Full at ≥1280px; collapsed into MoreDrawer below. */
  contextualControls?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  // Track the 1280px breakpoint for the contextual-controls collapse.
  const [wide, setWide] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setWide(mq.matches);
    apply();
    setHydrated(true);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // MoreDrawer open state — owned here so the trigger and panel are siblings.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // While hydrating, assume wide (SSR-safe — no layout flash on desktop).
  const showInline = !hydrated || wide;
  const hasContextual = !!contextualControls;

  // Close the drawer when the breakpoint flips to wide — otherwise a stale
  // `drawerOpen=true` state re-opens the drawer if we cross back to narrow.
  useEffect(() => {
    if (showInline) setDrawerOpen(false);
  }, [showInline]);

  return (
    <header
      aria-label={ariaLabel}
      className={`h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4 ${className}`}
    >
      {/* Identity — always visible, truncates under squeeze. */}
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">{identity}</div>

      <div className="flex-1 min-w-0" />

      {/* Contextual controls: inline at ≥1280px, MoreDrawer below. */}
      {hasContextual && showInline ? (
        <div className="flex items-center gap-2 shrink-0">{contextualControls}</div>
      ) : hasContextual ? (
        <MoreDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          {contextualControls}
        </MoreDrawer>
      ) : null}

      {/* Primary action — always visible, rightmost. */}
      {primaryAction && <div className="shrink-0">{primaryAction}</div>}
    </header>
  );
}