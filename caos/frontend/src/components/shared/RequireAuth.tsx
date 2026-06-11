"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/shared/AuthProvider";

/**
 * Wrap any page (or layout segment) that requires an authenticated user.
 * While the AuthProvider is loading we render a thin placeholder so there's
 * no content flash. Once loading is done and there's no user, we redirect
 * to /login and keep rendering null until the redirect completes.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caos-bg text-caos-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
