"use client";

/**
 * WARNING: The `ResponsiveContext` value is created at module scope ("use client").
 * If this file is ever imported by a server component, the server's context
 * instance would differ from the client's — a dual-context bug. Every consumer
 * must be a client component.
 */
import { createContext, useContext } from "react";

export type Breakpoint = "desktop" | "tablet" | "mobile";

export interface ResponsiveContextValue {
  breakpoint: Breakpoint;
  /** ≥1024px — the full desktop layout. */
  isDesktop: boolean;
  /** 768–1023px — panes stack vertically, header collapses to essentials. */
  isTablet: boolean;
  /** <768px — only essential panes, controls in a drawer. */
  isMobile: boolean;
}

export const ResponsiveContext = createContext<ResponsiveContextValue>({
  breakpoint: "desktop",
  isDesktop: true,
  isTablet: false,
  isMobile: false,
});

/** Consume the current breakpoint. Children use this to adapt their own rendering. */
export function useResponsive(): ResponsiveContextValue {
  return useContext(ResponsiveContext);
}