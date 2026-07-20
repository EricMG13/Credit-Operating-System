"use client";

// Route-level <h1> for every page — visually hidden (sr-only) so each route gets
// exactly one top heading landmark for assistive tech without touching the dense
// visual chrome. Lives in the root layout, so new routes inherit it for free.
// Visible in-page titles stay as <h2> content headings under this.
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/shared/AuthProvider";
import { routeTitleForPath } from "@/lib/nav";

interface RouteHeadingState {
  authTitle: string | null;
  override: string | null;
  setOverride: ((title: string | null) => void) | null;
}

const RouteHeadingContext = createContext<RouteHeadingState>({ authTitle: null, override: null, setOverride: null });
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function RouteHeadingProvider({ children }: { children: ReactNode }) {
  const { user, loading, error, needsLogin } = useAuth();
  const [override, setOverride] = useState<string | null>(null);
  const authTitle = loading
    ? "Checking analyst access"
    : needsLogin
      ? "Analyst sign-in"
      : error || !user
        ? "Analyst access could not be verified"
        : null;
  const value = useMemo(() => ({ authTitle, override, setOverride }), [authTitle, override]);
  return <RouteHeadingContext.Provider value={value}>{children}</RouteHeadingContext.Provider>;
}

export function RouteHeadingOverride({ title }: { title: string }) {
  const { setOverride } = useContext(RouteHeadingContext);
  useClientLayoutEffect(() => {
    setOverride?.(title);
    return () => setOverride?.(null);
  }, [setOverride, title]);
  return null;
}

export function RouteHeading() {
  const { authTitle, override } = useContext(RouteHeadingContext);
  const pathname = usePathname();
  return <h1 className="sr-only">{override ?? authTitle ?? routeTitleForPath(pathname)}</h1>;
}
