"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreDrawer } from "./MoreDrawer";
import { useBreakpoint } from "@/lib/useBreakpoint";

type CollapseState = { collapsed: boolean; neededWidth: number | null };

/**
 * Pure collapse decision with hysteresis, so overflow-driven collapse can't
 * oscillate (collapsing frees width → would re-expand → overflows again).
 * Collapse when the header overflows; record the width it needed. Only
 * re-expand once the header is at least that wide again. Exported for tests.
 */
export function nextCollapseState(
  s: CollapseState,
  m: { scrollWidth: number; clientWidth: number },
): CollapseState {
  if (!s.collapsed && m.scrollWidth > m.clientWidth + 1) {
    return { collapsed: true, neededWidth: m.scrollWidth };
  }
  if (s.collapsed && s.neededWidth !== null && m.clientWidth >= s.neededWidth) {
    return { collapsed: false, neededWidth: null };
  }
  return s;
}

const useOverflowCollapse = (
  contextualControls: React.ReactNode,
  primaryAction: React.ReactNode,
  status: React.ReactNode,
) => {
  const headerRef = useRef<HTMLElement>(null);
  const [collapse, setCollapse] = useState<CollapseState>({ collapsed: false, neededWidth: null });
  const measure = () => {
    const element = headerRef.current;
    if (!element) return;
    setCollapse((current) => nextCollapseState(current, {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
  };
  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextualControls, primaryAction, status]);
  return { headerRef, forceCollapsed: collapse.collapsed };
};

function SubHeaderStatus({ status }: { status?: React.ReactNode }) {
  return status ? <div className="hidden lg:flex items-center gap-2 shrink-0">{status}</div> : null;
}

function InlineContext({ show, children }: { show: boolean; children?: React.ReactNode }) {
  return show && children ? <div className="flex items-center gap-2 shrink-0">{children}</div> : null;
}

function HeaderDrawer({
  showInline,
  contextualControls,
  utilityControls,
  drawerOpen,
  setDrawerOpen,
  utilityLabel,
}: {
  showInline: boolean;
  contextualControls?: React.ReactNode;
  utilityControls?: React.ReactNode;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  utilityLabel: string;
}) {
  const content = showInline ? utilityControls : (
    <>
      {contextualControls}
      {contextualControls && utilityControls ? <div className="my-1 border-t border-caos-border" /> : null}
      {utilityControls}
    </>
  );
  if (!content) return null;
  return (
    <MoreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} triggerLabel={utilityLabel}>
      {content}
    </MoreDrawer>
  );
}

function PrimaryAction({ children }: { children?: React.ReactNode }) {
  return children ? <div className="shrink-0" data-page-primary-action>{children}</div> : null;
}

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

  // Measured overflow guard: even at the wide breakpoint, a page that passes
  // too many contextual controls (contract: ≤5) can push the primary action
  // off-screen. Observe the header and force-collapse into the drawer when it
  // overflows, with hysteresis so it can't oscillate. This is the backstop —
  // per-page configs should still respect the ≤5 rule.
  const { headerRef, forceCollapsed } = useOverflowCollapse(contextualControls, primaryAction, status);

  // While hydrating, assume wide (SSR-safe — no layout flash on desktop).
  const showInline = (!hydrated || breakpoint === "wide") && !forceCollapsed;

  // Close the drawer when the breakpoint flips to wide — otherwise a stale
  // `drawerOpen=true` state re-opens the drawer if we cross back to narrow.
  useEffect(() => {
    if (showInline) setDrawerOpen(false);
  }, [showInline]);

  return (
    <header
      ref={headerRef}
      aria-label={ariaLabel}
      className={`h-11 shrink-0 border-b border-caos-border bg-caos-panel/75 flex items-center gap-3 px-3 md:px-4 ${className}`}
    >
      {/* Identity — always visible, truncates under squeeze. min-w-28 floors it
          so overflow is detectable (a 0-width identity would let the primary
          action be pushed off-screen instead of triggering collapse). */}
      <div className="flex items-center gap-3 min-w-28 overflow-hidden">{identity}</div>

      <div className="flex-1 min-w-0" />

      <SubHeaderStatus status={status} />

      {/* Contextual controls: inline at ≥1280px, MoreDrawer below. */}
      <InlineContext show={showInline}>{contextualControls}</InlineContext>

      <HeaderDrawer showInline={showInline} contextualControls={contextualControls} utilityControls={utilityControls} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} utilityLabel={utilityLabel} />

      {/* Primary action — always visible, rightmost. */}
      <PrimaryAction>{primaryAction}</PrimaryAction>
    </header>
  );
}
