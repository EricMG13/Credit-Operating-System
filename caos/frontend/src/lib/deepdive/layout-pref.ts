// Deep-Dive module layout preference — browser-local (localStorage), no server
// round-trip. Settings edits it; the Deep-Dive page reads it on mount.
//   core  — original: workflow register, then sections in source order
//   base  — conclusion-first; workflow steps in up to 4 columns stretched to
//           fill the width, wrapping to rows below (recommended)
//   dense — conclusion-first; workflow steps packed into newspaper columns
//           (maximum density)
export type DeepDiveLayout = "core" | "base" | "dense";

export const DEFAULT_LAYOUT: DeepDiveLayout = "base";

const KEY = "caos.deepdive.layout";

export function loadLayout(): DeepDiveLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const v = localStorage.getItem(KEY);
    return v === "core" || v === "base" || v === "dense" ? v : DEFAULT_LAYOUT;
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
