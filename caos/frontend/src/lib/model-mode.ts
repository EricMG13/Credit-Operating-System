// Per-analyst model mode — the cost↔quality tier the engine runs its LLM lanes
// at. Browser-local (localStorage), sent on every request as the X-Model-Mode
// header (see lib/api.ts). The server resolves it per lane (engine/presets.py):
// TEST is cheapest, MAX is highest-reasoning. Each run pins the mode it ran at.

export type ModelMode = "TEST" | "LITE" | "BALANCED" | "MAX";

export const MODEL_MODES: { value: ModelMode; label: string; hint: string }[] = [
  { value: "TEST", label: "Test", hint: "Cheapest — stress-test, not quality" },
  { value: "LITE", label: "Lite", hint: "Fast — favours latency" },
  { value: "BALANCED", label: "Balanced", hint: "Strong where it matters, cheap elsewhere" },
  { value: "MAX", label: "Max", hint: "Highest reasoning & effort" },
];

export const DEFAULT_MODE: ModelMode = "TEST";

const KEY = "caos.model.mode";

export function loadMode(): ModelMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const v = localStorage.getItem(KEY);
  return MODEL_MODES.some((m) => m.value === v) ? (v as ModelMode) : DEFAULT_MODE;
}

export function saveMode(m: ModelMode): void {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* private mode / quota — the mode just doesn't persist */
  }
}
