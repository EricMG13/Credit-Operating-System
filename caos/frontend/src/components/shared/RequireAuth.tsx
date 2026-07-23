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
        <SurfaceState kind="loading" title="Checking analyst access" detail="Verifying your CAOS session." headingLevel={2} compact className="max-w-sm w-full" />
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
          title="Analyst access could not be verified"
          headingLevel={2}
          detail="The CAOS service did not respond. Check your connection, then retry. If it persists, contact your CAOS administrator."
          primaryAction={
            <button
              onClick={() => refresh()}
              type="button"
              className="caos-action-primary focus-ring"
            >
              Retry access check
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
