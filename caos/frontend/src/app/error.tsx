"use client";

// Per-route error boundary (App Router). Catches render/data exceptions in any
// route segment and shows a recoverable surface instead of a blank screen — the
// rest of the workspace chrome (root layout) stays mounted. Runs client-side in
// the static export. Pairs with global-error.tsx, which catches failures in the
// root layout itself.

import { useEffect } from "react";

export default function Error({
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
      <div
        role="alert"
        className="w-full max-w-md flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-critical">
            Error
          </span>
          <h1 className="text-caos-text text-lg font-semibold">Something broke on this view</h1>
          <p className="text-caos-muted text-xs">
            The rest of the workspace is unaffected. Retry, or reload the page if it persists.
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-caos-sm text-caos-muted/60">ref {error.digest}</p>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-caos-accent bg-caos-accent px-3 py-2 text-sm font-semibold text-caos-bg transition-caos hover:opacity-90 focus-ring"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
