"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/components/shared/AuthProvider";
import { LoginLanding } from "@/components/shared/LoginLanding";

/**
 * Gates content on a signed-in analyst profile. Three terminal states:
 *  - needsLogin → the code-gated login landing (create / re-attach a profile);
 *  - error      → the API is unreachable (down server / dead proxy), not a login
 *                 problem, so we show a retry card rather than the login form;
 *  - profile    → render the app.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, error, needsLogin, refresh } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caos-bg text-caos-muted text-sm">
        Loading…
      </div>
    );
  }

  if (needsLogin) {
    return <LoginLanding onSuccess={refresh} />;
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-caos-bg text-center px-4">
        <p className="text-caos-text text-sm font-medium">Can&apos;t reach the CAOS API</p>
        <p className="text-caos-muted text-xs max-w-sm">
          Identity could not be resolved. If you are running locally, start the
          server (python caos/server/run.py) and retry.
        </p>
        <button
          onClick={() => refresh()}
          className="tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
        >
          RETRY
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
