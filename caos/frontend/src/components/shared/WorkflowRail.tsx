"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, routeMatches } from "@/lib/nav";
import { RoleViewSwitch } from "./RoleViewSwitch";
import { AnalystBadge } from "./AnalystBadge";

/**
 * Desktop workflow rail. It is intentionally driven by the same NAV_GROUPS
 * registry as keyboard concept cycling and compact navigation, so spatial and
 * keyboard order cannot drift. The rail owns desktop navigation; ConceptNav
 * remains the tablet/mobile fallback.
 */
export function WorkflowRail() {
  const pathname = usePathname() || "/issuers";

  return (
    <aside className="caos-workflow-rail" aria-label="Workspace navigation">
      <div className="h-14 px-5 flex items-center border-b border-caos-border">
        <Link href="/command" className="no-underline focus-ring rounded-sm" aria-label="CAOS Command Center">
          <span className="block text-caos-xl font-semibold tracking-[0.24em] text-caos-text">CAOS</span>
          <span className="block mt-0.5 tabular text-caos-2xs tracking-[0.12em] text-caos-muted">CREDIT AGENT OS</span>
        </Link>
      </div>

      <nav id="workspace-nav" aria-label="Workflow" className="caos-rail-scroll flex-1 min-h-0 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`workflow-${group.id}`}
            data-active={group.items.some((item) => routeMatches(pathname, item.href))}
            className="caos-rail-group mb-4 last:mb-0"
          >
            <h2
              id={`workflow-${group.id}`}
              className="px-2.5 mb-1.5 tabular text-caos-2xs font-medium uppercase tracking-[0.18em] text-caos-muted"
            >
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = routeMatches(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`caos-rail-link focus-ring ${active ? "caos-rail-link-active" : ""}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-caos-border p-2.5 space-y-2">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={`caos-rail-link focus-ring ${pathname.startsWith("/settings") ? "caos-rail-link-active" : ""}`}
        >
          <span>Settings</span>
        </Link>
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <RoleViewSwitch />
          <AnalystBadge />
        </div>
      </div>
    </aside>
  );
}
