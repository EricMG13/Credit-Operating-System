"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, navItemForPath, rolePriorityItems, routeMatches } from "@/lib/nav";
import { RoleViewSwitch } from "./RoleViewSwitch";
import { AnalystBadge } from "./AnalystBadge";
import { useRoleView } from "./RoleViewProvider";
import { AskUtility } from "./AskShell";
import { preserveDataModeInHref, useDataMode } from "@/lib/data-mode";

/**
 * Desktop workflow rail. It is intentionally driven by the same NAV_GROUPS
 * registry as keyboard concept cycling and compact navigation, so spatial and
 * keyboard order cannot drift. The rail owns desktop navigation; ConceptNav
 * remains the tablet/mobile fallback.
 */
export function WorkflowRail() {
  const pathname = usePathname() || "/issuers";
  const { roleView } = useRoleView();
  const [allOpen, setAllOpen] = useState(false);
  const dataMode = useDataMode();
  const modeHref = (href: string) => preserveDataModeInHref(href, dataMode);
  const roleLabel = roleView === "pm" ? "PM" : roleView === "qa" ? "QA" : "Analyst";
  const priority = rolePriorityItems(roleView);
  const activeItem = navItemForPath(pathname);
  const priorityItems = activeItem && !priority.some((item) => item.href === activeItem.href)
    ? [...priority, activeItem]
    : priority;

  return (
    <aside className="caos-workflow-rail" aria-label="Workspace navigation">
      <div className="h-14 px-5 flex items-center border-b border-caos-border">
        <Link href={modeHref("/command")} prefetch={false} className="no-underline focus-ring rounded-sm" aria-label="CAOS Command Center">
          <span className="block text-caos-xl font-semibold tracking-[0.24em] text-caos-text">CAOS</span>
          <span className="block mt-0.5 tabular text-caos-2xs tracking-[0.12em] text-caos-muted">CREDIT AGENT OS</span>
        </Link>
      </div>

      <div className="caos-rail-scroll flex-1 min-h-0 overflow-y-auto px-2.5 py-4">
        <nav id="workflow-priority-nav" tabIndex={-1} aria-label={`${roleLabel} priority workflows`} className="focus-ring rounded-sm">
          <h2 className="px-2.5 mb-1.5 tabular text-caos-2xs font-medium uppercase tracking-[0.18em] text-caos-muted">{roleLabel} priorities</h2>
          <div className="space-y-0.5">
            {priorityItems.map((item) => {
              const active = routeMatches(pathname, item.href);
              return <Link key={item.href} href={modeHref(item.href)} prefetch={false} aria-current={active ? "page" : undefined} className={`caos-rail-link focus-ring ${active ? "caos-rail-link-active" : ""}`}><span>{item.label}</span></Link>;
            })}
          </div>
        </nav>
        <details className="mt-4 border-t border-caos-border pt-3" open={allOpen}>
          <summary
            className="caos-rail-link focus-ring cursor-pointer"
            onClick={(event) => {
              event.preventDefault();
              setAllOpen((open) => !open);
            }}
          >
            All Workflows
          </summary>
          {allOpen ? <nav aria-label="All Workflows" className="mt-2 space-y-3">
            {NAV_GROUPS.map((group) => <section key={group.id} aria-label={group.label}><h2 className="px-2.5 mb-1 tabular text-caos-2xs uppercase tracking-[0.18em] text-caos-muted">{group.label}</h2>{group.items.map((item) => { const active = routeMatches(pathname, item.href); return <Link key={item.href} href={modeHref(item.href)} prefetch={false} aria-current={active ? "page" : undefined} className={`caos-rail-link focus-ring ${active ? "caos-rail-link-active" : ""}`}>{item.label}</Link>; })}</section>)}
          </nav> : null}
        </details>
      </div>

      <div className="border-t border-caos-border p-2.5 space-y-2">
        <section aria-label="Ask utility"><AskUtility /></section>
        <Link
          href={modeHref("/settings")}
          prefetch={false}
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
