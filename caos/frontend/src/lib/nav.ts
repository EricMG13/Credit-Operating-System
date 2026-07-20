// Single source of truth for concept navigation: the workflow groups rendered
// by ConceptNav and the Alt+←/→ cycle order consumed by ConceptHotkeys.
// Cycle order = visual order, always — the two drifted before this file
// existed (ConceptHotkeys kept its own list that omitted /issuers and /upload
// and disagreed with ConceptNav's order).

import type { RoleView } from "@/lib/api";

export type NavItem = { href: string; icon: string; label: string };

export type NavGroupId = "intake" | "analyze" | "decide" | "publish" | "monitor";

export type NavGroup = { id: NavGroupId; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "intake",
    label: "Intake",
    items: [
      { href: "/issuers", icon: "directory", label: "Directory" },
      { href: "/upload", icon: "upload", label: "Upload" },
    ],
  },
  {
    id: "analyze",
    label: "Analyze",
    items: [
      { href: "/research", icon: "research", label: "Research" },
      { href: "/query", icon: "query", label: "Query" },
      { href: "/sector", icon: "sector", label: "Sector Review" },
      { href: "/sector-rv", icon: "sector-rv", label: "RV Screener" },
      { href: "/sponsors", icon: "sponsors", label: "Sponsors" },
    ],
  },
  {
    id: "decide",
    label: "Decide",
    items: [
      { href: "/command", icon: "command", label: "Command Center" },
      { href: "/portfolios", icon: "portfolio", label: "Portfolio Lab" },
      { href: "/deepdive", icon: "deepdive", label: "Deep-Dive" },
      { href: "/model", icon: "model", label: "Model Builder" },
      { href: "/decisions", icon: "decisions", label: "IC Book" },
    ],
  },
  {
    id: "publish",
    label: "Publish",
    items: [{ href: "/reports", icon: "report", label: "Report Studio" }],
  },
  {
    id: "monitor",
    label: "Monitor",
    items: [
      { href: "/pipeline", icon: "pipeline", label: "Pipeline" },
      { href: "/monitor", icon: "monitor", label: "Alert Monitor" },
    ],
  },
];

/** Alt+←/→ stops, in visual nav order. */
export const CONCEPT_CYCLE: string[] = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

type RouteMetadata = {
  pattern: string;
  title: string;
  exact?: boolean;
};

// Route headings share the workflow ontology above. Only utility routes and a
// more-specific issuer profile pattern are additive metadata; workflow labels
// are always derived from NAV_GROUPS so navigation and document titles cannot
// drift into competing maps.
export const ROUTE_METADATA: readonly RouteMetadata[] = [
  ...NAV_ITEMS.map((item) => ({ pattern: item.href, title: item.label })),
  { pattern: "/issuers/profile", title: "Issuer Profile" },
  { pattern: "/issuers/[issuerId]", title: "Issuer Profile" },
  { pattern: "/settings", title: "Settings" },
  { pattern: "/", title: "CAOS Home", exact: true },
];

export const ROLE_PRIORITY_HREFS = {
  analyst: ["/issuers", "/deepdive", "/model", "/reports", "/pipeline"],
  pm: ["/command", "/portfolios", "/decisions", "/reports", "/monitor"],
  qa: ["/monitor", "/pipeline", "/decisions", "/reports", "/upload"],
} as const satisfies Record<RoleView, readonly string[]>;

export function rolePriorityItems(role: RoleView): NavItem[] {
  return ROLE_PRIORITY_HREFS[role].map((href) => NAV_ITEMS.find((item) => item.href === href)!);
}

export function navItemForPath(pathname: string): NavItem | null {
  return NAV_ITEMS.find((item) => routeMatches(pathname, item.href)) ?? null;
}

function normalizedPathname(pathname: string | null | undefined): string {
  const path = (pathname || "/").split(/[?#]/, 1)[0] || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function routeMetadataMatches(pathname: string, route: RouteMetadata): boolean {
  if (route.exact) return pathname === route.pattern;
  if (route.pattern.includes("[issuerId]")) {
    const prefix = route.pattern.slice(0, route.pattern.indexOf("[issuerId]"));
    const remainder = pathname.slice(prefix.length);
    return pathname.startsWith(prefix) && Boolean(remainder.split("/")[0]);
  }
  return routeMatches(pathname, route.pattern);
}

/** Accurate route-level title, with longest/specific metadata winning. */
export function routeTitleForPath(pathname: string | null | undefined): string {
  if (!pathname) return "CAOS";
  const normalized = normalizedPathname(pathname);
  const match = ROUTE_METADATA
    .filter((route) => routeMetadataMatches(normalized, route))
    .sort((left, right) => right.pattern.length - left.pattern.length)[0];
  return match?.title ?? "Page not found";
}

export function routeMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function activeGroupId(pathname: string): NavGroupId | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => routeMatches(pathname, i.href))) return g.id;
  }
  return null;
}
