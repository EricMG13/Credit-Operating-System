// Pure row model for the ⌘K command palette — sources and ranking live here
// (testable, no React). Pages come from the nav registry, actions are the few
// global gestures, and free text ALWAYS carries an `Ask CAOS: "<text>"` row:
// ranked FIRST when the input doesn't strongly match a page/action, so the
// old ⌘K→type→Enter Ask muscle memory still lands in Ask (RT-2026-07-11-62).
// Issuer rows are appended by the component (async search, same contract as
// GlobalIssuerSearch).

import { NAV_GROUPS } from "./nav";

export interface PageRow {
  kind: "page";
  href: string;
  label: string;
  group: string;
}
export interface ActionRow {
  kind: "action";
  id: "role-analyst" | "role-pm" | "role-qa" | "collapse";
  label: string;
}
export interface AskRow {
  kind: "ask";
  text: string;
}
export interface IssuerRow {
  kind: "issuer";
  id: string;
  label: string;
  sub?: string;
}
export type PaletteRow = PageRow | ActionRow | AskRow | IssuerRow;

export const PALETTE_PAGES: PageRow[] = [
  ...NAV_GROUPS.flatMap((g) =>
    g.items.map((i): PageRow => ({ kind: "page", href: i.href, label: i.label, group: g.label })),
  ),
  { kind: "page", href: "/settings", label: "Settings", group: "Utility" },
];

export const PALETTE_ACTIONS: ActionRow[] = [
  { kind: "action", id: "role-analyst", label: "Role view: Analyst" },
  { kind: "action", id: "role-pm", label: "Role view: PM" },
  { kind: "action", id: "role-qa", label: "Role view: QA" },
  { kind: "action", id: "collapse", label: "Collapse / expand panes" },
];

/** Static (non-issuer) rows for a query. Empty query = browse mode: every
 *  page in workflow order, no ask row. */
export function staticRows(query: string): PaletteRow[] {
  const text = query.trim();
  const q = text.toLowerCase();
  if (!q) return [...PALETTE_PAGES];

  const scored: { row: PaletteRow; score: number }[] = [];
  for (const p of PALETTE_PAGES) {
    const l = p.label.toLowerCase();
    if (l.startsWith(q)) scored.push({ row: p, score: 100 });
    else if (l.includes(q)) scored.push({ row: p, score: 60 });
    else if (p.group.toLowerCase().startsWith(q)) scored.push({ row: p, score: 40 });
  }
  for (const a of PALETTE_ACTIONS) {
    if (a.label.toLowerCase().includes(q)) scored.push({ row: a, score: 50 });
  }
  // Ask passthrough: first for question-shaped input, below a strong page hit.
  const strong = scored.some((s) => s.score >= 100);
  scored.push({ row: { kind: "ask", text }, score: strong ? 10 : 90 });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.row);
}
