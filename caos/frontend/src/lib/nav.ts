// Single source of truth for concept navigation: the workflow groups rendered
// by ConceptNav and the Alt+←/→ cycle order consumed by ConceptHotkeys.
// Cycle order = visual order, always — the two drifted before this file
// existed (ConceptHotkeys kept its own list that omitted /issuers and /upload
// and disagreed with ConceptNav's order).

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
      { href: "/deepdive", icon: "deepdive", label: "Deep-Dive" },
      { href: "/model", icon: "model", label: "Model Builder" },
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

export function routeMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function activeGroupId(pathname: string): NavGroupId | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => routeMatches(pathname, i.href))) return g.id;
  }
  return null;
}
