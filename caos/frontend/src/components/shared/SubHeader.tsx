"use client";

import { useEffect, useState } from "react";
import { MoreDrawer } from "./MoreDrawer";
import { useBreakpoint } from "@/lib/useBreakpoint";

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
  status,
  primaryAction,
  contextualControls,
  utilityControls,
  utilityLabel = "Utilities",
  className = "",
  "aria-label": ariaLabel,
}: {
  /** Identity that survives every breakpoint: back-link + concept nav + issuer/run/deal label. */
  identity: React.ReactNode;
  /** Page-wide status/as-of state. Distinct from contextual controls. */
  status?: React.ReactNode;
  /** The ONE primary action for this concept (SAVE MODEL, EXPORT PDF, ASK, INTAKE, → MONITOR). */
  primaryAction?: React.ReactNode;
  /** Contextual controls. Full at ≥1280px; collapsed into MoreDrawer below. */
  contextualControls?: React.ReactNode;
  /** Low-frequency controls that always live in the labeled utility drawer. */
  utilityControls?: React.ReactNode;
  utilityLabel?: string;
  className?: string;
  "aria-label"?: string;
}) {
  // The 1280px contextual-controls collapse comes from the shared shell
  // breakpoint hook — one source with ResponsiveShell (RT-2026-07-11-64).
  const { breakpoint, hydrated } = useBreakpoint();

  // MoreDrawer open state — owned here so the trigger and panel are siblings.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // While hydrating, assume wide (SSR-safe — no layout flash on desktop).
  const showInline = !hydrated || breakpoint === "wide";
  const hasContextual = !!contextualControls;
  const drawerContent = showInline ? utilityControls : (
    <>
      {contextualControls}
      {contextualControls && utilityControls ? <div className="my-1 border-t border-caos-border" /> : null}
      {utilityControls}
    </>
  );
  const hasDrawer = !!drawerContent;

  // Close the drawer when the breakpoint flips to wide — otherwise a stale
  // `drawerOpen=true` state re-opens the drawer if we cross back to narrow.
  useEffect(() => {
    if (showInline) setDrawerOpen(false);
  }, [showInline]);

  return (
    <header
      aria-label={ariaLabel}
      className={`h-12 shrink-0 border-b border-caos-border bg-caos-panel/75 flex items-center gap-3 px-3 md:px-4 ${className}`}
    >
      {/* Identity — always visible, truncates under squeeze. */}
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">{identity}</div>

      <div className="flex-1 min-w-0" />

      {status ? <div className="hidden lg:flex items-center gap-2 shrink-0">{status}</div> : null}

      {/* Contextual controls: inline at ≥1280px, MoreDrawer below. */}
      {hasContextual && showInline ? (
        <div className="flex items-center gap-2 shrink-0">{contextualControls}</div>
      ) : null}

      {hasDrawer ? (
        <MoreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} triggerLabel={utilityLabel}>
          {drawerContent}
        </MoreDrawer>
      ) : null}

      {/* Primary action — always visible, rightmost. */}
      {primaryAction && <div className="shrink-0" data-page-primary-action>{primaryAction}</div>}
    </header>
  );
}
