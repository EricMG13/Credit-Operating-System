// The one registry of keyboard shortcuts. The help overlay renders exactly
// this list, so a binding documented here MUST exist in code — a help surface
// that lists a dead key costs more trust than no help surface at all.
// Global bindings live in ConceptHotkeys.tsx (Alt combos, "?") and
// CommandPalette.tsx (⌘K); route-scoped ones in their owning components.
// Scope discipline: an entry is global ONLY if a listener exists on every
// route (grep the event name before promoting one) — Alt+C and Alt+,/. were
// once listed global while only two surfaces listened, which the help card's
// own contract forbids.

export interface ShortcutEntry {
  /** Display chip, e.g. "⌘K" or "Alt + ←/→". */
  keys: string;
  label: string;
  /** Route prefixes this binding is scoped to; absent = global. */
  routes?: string[];
  routeLabel?: string;
}

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: "⌘K / Ctrl+K · Alt + S", label: "Open the command palette" },
  { keys: "Alt + K", label: "Ask across coverage (focuses the composer on /query)" },
  { keys: "Alt + ← / →", label: "Cycle between concepts (Command, Monitor, Deep-Dive…)" },
  { keys: "?", label: "Open this shortcut reference" },
  { keys: "Alt + C", label: "Collapse / expand the workspace rails", routes: ["/deepdive", "/model"], routeLabel: "Deep-Dive · Model" },
  { keys: "⌘M / Ctrl+M", label: "Find a module by code or name", routes: ["/deepdive", "/model"], routeLabel: "Deep-Dive · Model" },
  { keys: "Alt + , / .", label: "Cycle sub-views within the surface", routes: ["/pipeline", "/deepdive"], routeLabel: "Pipeline · Deep-Dive" },
  { keys: "+ / −", label: "Step the sheet zoom", routes: ["/reports"], routeLabel: "Report Studio" },
  { keys: "F", label: "Fit the sheet to the preview width", routes: ["/reports"], routeLabel: "Report Studio" },
  { keys: "1–9", label: "Jump to the nth deliverable", routes: ["/reports"], routeLabel: "Report Studio" },
];

/** Entries for the current route: global first, then this page's. */
export function shortcutsFor(pathname: string): { global: ShortcutEntry[]; route: ShortcutEntry[] } {
  const global = SHORTCUTS.filter((entry) => !entry.routes);
  const route = SHORTCUTS.filter((entry) => entry.routes?.some((prefix) => pathname.startsWith(prefix)));
  return { global, route };
}
