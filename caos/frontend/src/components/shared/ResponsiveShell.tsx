"use client";

import { useEffect, useState, useCallback } from "react";
import { SubHeader } from "./SubHeader";

type Breakpoint = "desktop" | "tablet" | "mobile";

/**
 * A breakpoint-aware chrome that wraps every concept page. Desktop (≥1024px) is
 * a passthrough — zero regression risk. Below that, the header collapses to
 * essential controls and panes stack vertically.
 *
 * Usage (per concept):
 *   <ResponsiveShell
 *     identity={<>← Directory · Nav · US HY sleeve</>}
 *     primaryAction={<Link href="/monitor">→ Monitor</Link>}
 *     contextualControls={<>{headStats} <SimControls /></>}
 *     narrowContract={…}
 *   >
 *     {children}  // desktop layout — ResponsiveShell renders as-is at ≥1024px
 *   </ResponsiveShell>
 *
 */
export function ResponsiveShell({
  identity,
  primaryAction,
  contextualControls,
  narrowContract,
  children,
  className = "",
  heightClass = "h-screen",
}: {
  identity: React.ReactNode;
  primaryAction?: React.ReactNode;
  contextualControls?: React.ReactNode;
  narrowContract: NarrowContract;
  children: React.ReactNode;
  className?: string;
  /** Override the default full-viewport height. Use "h-full" for overlay/modals. */
  heightClass?: string;
}) {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  // matchMedia at 1024px and 768px, coalesced via requestAnimationFrame so a
  // rapid resize across the boundary doesn't flicker between breakpoints.
  const apply = useCallback(() => {
    const w = window.innerWidth;
    setBreakpoint(w >= 1024 ? "desktop" : w >= 768 ? "tablet" : "mobile");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    apply();
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [apply]);

  const isDesktop = breakpoint === "desktop";

  // At narrow breakpoints, the header shows only essential controls (max 3).
  // The full set renders at desktop only.
  const headerContextual = isDesktop
    ? contextualControls
    : narrowContract.essentialControls;

  return (
    <div className={`${heightClass} flex flex-col bg-caos-bg ${className}`}>
      <SubHeader
        identity={identity}
        primaryAction={primaryAction}
        contextualControls={headerContextual}
        aria-label="Concept header"
      />
      {children}
    </div>
  );
}

/**
 * The narrow-mode contract for this concept. Defines what controls survive at
 * narrow breakpoints. The full control set renders at ≥1280px via `contextualControls`.
 */
export interface NarrowContract {
  /** Essential controls shown at <1280px (max 3-5). The full set renders at ≥1280px. */
  essentialControls: React.ReactNode;
}