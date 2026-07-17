"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/components/shared/AuthProvider";
import { LoginLanding } from "@/components/shared/LoginLanding";
import { SurfaceState } from "@/components/shared/SurfaceState";

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
      <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4">
        <SurfaceState kind="loading" title="Loading…" compact className="max-w-sm w-full" />
      </div>
    );
  }

  if (needsLogin) {
    return <LoginLanding onSuccess={refresh} />;
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4">
        <SurfaceState
          kind="error"
          title="Can't reach the CAOS API"
          detail="Identity could not be resolved. If you are running locally, start the server (python caos/server/run.py) and retry."
          primaryAction={
            <button
              onClick={() => refresh()}
              className="tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
            >
              RETRY
            </button>
          }
          compact
          className="max-w-sm w-full text-center"
        />
      </div>
    );
  }

  return <>{children}</>;
}
