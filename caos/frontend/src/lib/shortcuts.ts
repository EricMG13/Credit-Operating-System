// The one registry of keyboard shortcuts. The help overlay renders exactly
// this list, so a binding documented here MUST exist in code — a help surface
// that lists a dead key costs more trust than no help surface at all.
// Global bindings live in ConceptHotkeys.tsx (Alt combos, "?") and
// CommandPalette.tsx (⌘K); route-scoped ones in their owning components.

export interface ShortcutEntry {
  /** Display chip, e.g. "⌘K" or "Alt + ←/→". */
  keys: string;
  label: string;
  /** Route prefix this binding is scoped to; absent = global. */
  route?: string;
  routeLabel?: string;
}

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: "⌘K / Ctrl+K", label: "Open the command palette" },
  { keys: "Alt + S", label: "Open the command palette" },
  { keys: "Alt + K", label: "Ask across coverage (focuses the composer on /query)" },
  { keys: "Alt + C", label: "Collapse / expand the decision brief" },
  { keys: "Alt + ← / →", label: "Cycle between concepts (Command, Monitor, Deep-Dive…)" },
  { keys: "Alt + , / .", label: "Cycle sub-views within the current surface" },
  { keys: "?", label: "Open this shortcut reference" },
  { keys: "⌘M / Ctrl+M", label: "Find a module by code or name", route: "/deepdive", routeLabel: "Deep-Dive · Model" },
  { keys: "+ / −", label: "Step the sheet zoom", route: "/reports", routeLabel: "Report Studio" },
  { keys: "F", label: "Fit the sheet to the preview width", route: "/reports", routeLabel: "Report Studio" },
  { keys: "1–9", label: "Jump to the nth deliverable", route: "/reports", routeLabel: "Report Studio" },
];

/** Entries for the current route: global first, then this page's. */
export function shortcutsFor(pathname: string): { global: ShortcutEntry[]; route: ShortcutEntry[] } {
  const global = SHORTCUTS.filter((entry) => !entry.route);
  const route = SHORTCUTS.filter((entry) => entry.route && (
    pathname.startsWith(entry.route)
    // ⌘M is mounted on both Deep-Dive and Model.
    || (entry.route === "/deepdive" && pathname.startsWith("/model"))
  ));
  return { global, route };
}
