"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/components/shared/AuthProvider";

/**
 * Gates content on a resolved identity. Authentication happens at the
 * Databricks Apps platform edge, so an unreachable /api/auth/me means the
 * API server is down (or a local dev server isn't running) — not that the
 * user needs to log in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, refresh } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caos-bg text-caos-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-caos-bg text-center px-4">
        <p className="text-caos-text text-sm font-medium">Can&apos;t reach the CAOS API</p>
        <p className="text-caos-muted text-xs max-w-sm">
          Identity could not be resolved. If you are running locally, start the
          server (python caos/server/run.py) and retry.
        </p>
        <button
          onClick={() => refresh()}
          className="tabular text-[10px] px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
        >
          RETRY
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
