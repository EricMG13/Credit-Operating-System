// Deep-Dive module layout preference -- browser-local (localStorage), no server
// round-trip. The Deep-Dive page reads it on mount.
//   summary -- analysis body with compact workflow-step summary
//   report  -- conclusion-first module report with consolidated workflow cards
//   dense   -- max-density audit view with unconsolidated packed steps
export type DeepDiveLayout = "summary" | "report" | "dense";

export const DEFAULT_LAYOUT: DeepDiveLayout = "report";

const KEY = "caos.deepdive.layout";
const LEGACY: Record<string, DeepDiveLayout> = {
  core: "summary",
  base: "report",
  dense: "dense",
};

export function loadLayout(): DeepDiveLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "summary" || v === "report" || v === "dense") return v;
    const migrated = v ? LEGACY[v] : undefined;
    if (migrated) {
      localStorage.setItem(KEY, migrated);
      return migrated;
    }
    return DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(l: DeepDiveLayout): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* private mode / quota — preference just doesn't persist */
  }
}
