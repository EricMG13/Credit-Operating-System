"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { SurfaceState } from "@/components/shared/SurfaceState";

// The root is the only unaffiliated entry point. Named routes and their query
// contexts stay authoritative; this merely gives a cold root visit the existing
// presentation preference's most useful starting surface.
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { roleView, ready } = useRoleView();

  useEffect(() => {
    if (!ready) return;
    const query = searchParams.toString();
    // A query on the root is already an explicit navigation context. Preserve
    // it rather than applying a role default over an issuer/context deep link.
    router.replace(query ? `/issuers?${query}` : roleView === "pm" ? "/command" : roleView === "qa" ? "/monitor" : "/issuers");
  }, [ready, roleView, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4">
      <SurfaceState kind="loading" title="Opening workspace…" compact className="max-w-sm w-full" />
    </div>
  );
}
