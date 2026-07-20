"use client";

// Per-route error boundary body (App Router). Catches render/data exceptions in
// a route segment and shows a recoverable surface instead of a blank screen —
// the rest of the workspace chrome (root layout) stays mounted. Runs client-side
// in the static export. Pairs with global-error.tsx, which catches failures in
// the root layout itself. Shared by every app/**/error.tsx — was six copies of
// this same body (fallow duplication finding, code-health audit 2026-07-10).

import { useEffect } from "react";
import { RouteHeadingOverride } from "@/components/shared/RouteHeading";

export default function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console; the server access log already records the
    // API side. No external tracker by policy (no-paid-services).
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4">
      <RouteHeadingOverride title="This view could not load" />
      <div
        role="alert"
        className="w-full max-w-md flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-critical">
            View error
          </span>
          <h2 className="text-caos-text text-lg font-semibold">This view could not load</h2>
          <p className="text-caos-muted text-xs">
            Work on other CAOS surfaces is unchanged. Reload this view; if it fails again, refresh the workspace and quote the reference below.
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-caos-sm text-caos-muted">ref {error.digest}</p>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-caos-accent bg-caos-accent px-3 py-2 text-sm font-semibold text-caos-bg transition-caos hover:opacity-90 focus-ring"
        >
          Retry view load
        </button>
      </div>
    </div>
  );
}
