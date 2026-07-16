"use client";

// The single breakpoint source for shell chrome. Replaces two stacked,
// non-communicating systems (SubHeader's private 1280px matchMedia and
// ResponsiveShell's innerWidth resize listener at 1024/768) with one hook so
// the collapse thresholds can never disagree (RT-2026-07-11-64).
//
//   wide    ≥1280  full contextual controls inline
//   desktop ≥1024  contextual controls collapse into MoreDrawer
//   tablet  ≥768   narrow contract (essential controls only)
//   mobile  <768   narrow contract, stacked panes

import { useEffect, useState } from "react";

export type Breakpoint = "wide" | "desktop" | "tablet" | "mobile";

export const BP_WIDE = 1280;
// Compact-band squeeze: below this the inline View toggle collapses into the
// Concepts drawer (globals.css .caos-compact-view). CSS-only cutoff — named
// here so breakpoints.contract.test.ts pins the two in lockstep.
export const BP_COMPACT_SQUEEZE = 1150;
export const BP_DESKTOP = 1024;
export const BP_TABLET = 768;

// SSR / pre-hydration renders assume "wide" — same no-flash-on-desktop
// behavior both prior systems had.
export function useBreakpoint(): { breakpoint: Breakpoint; hydrated: boolean } {
  const [state, setState] = useState<{ breakpoint: Breakpoint; hydrated: boolean }>({
    breakpoint: "wide",
    hydrated: false,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mqs = [
      window.matchMedia(`(min-width: ${BP_WIDE}px)`),
      window.matchMedia(`(min-width: ${BP_DESKTOP}px)`),
      window.matchMedia(`(min-width: ${BP_TABLET}px)`),
    ];
    const compute = (): Breakpoint =>
      mqs[0].matches ? "wide" : mqs[1].matches ? "desktop" : mqs[2].matches ? "tablet" : "mobile";
    // rAF-coalesced so a rapid drag across a boundary doesn't flicker.
    let raf = 0;
    const apply = () => setState({ breakpoint: compute(), hydrated: true });
    apply();
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    mqs.forEach((m) => m.addEventListener("change", onChange));
    return () => {
      mqs.forEach((m) => m.removeEventListener("change", onChange));
      cancelAnimationFrame(raf);
    };
  }, []);

  return state;
}
