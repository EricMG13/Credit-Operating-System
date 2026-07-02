// Which renderers make sense for a graph — keyed by capability first (specific
// overrides), then render mode. A view outside this list degrades into nonsense
// (a peer set has no lineage steps; layout x/y are not metric axes), so the
// switcher must never offer it. First entry = the native view a fresh run opens on.

export type QueryView = "graph" | "trace" | "rv" | "scatter";

export const VIEW_LABELS: Record<QueryView, string> = {
  graph: "Graph",
  trace: "Lineage",
  rv: "Table",
  scatter: "Scatter",
};

// Capabilities whose x/y actually encode metrics (the only honest scatter).
const BY_CAP: Record<string, QueryView[]> = {
  scatter: ["scatter", "rv"],
};

const BY_MODE: Record<string, QueryView[]> = {
  peers: ["graph", "rv"],
  contagion: ["graph", "rv"],
  concentration: ["graph", "rv"],
  provenance: ["trace", "graph", "rv"],
};

export function viewsFor(capabilityId: string | null | undefined, mode: string | null | undefined): QueryView[] {
  if (capabilityId && BY_CAP[capabilityId]) return BY_CAP[capabilityId];
  if (mode && BY_MODE[mode]) return BY_MODE[mode];
  return ["graph", "rv"];
}

export function nativeView(capabilityId: string | null | undefined, mode: string | null | undefined): QueryView {
  return viewsFor(capabilityId, mode)[0];
}

// Belt-and-braces at render time: a stale view (e.g. restored state) coerces to
// the graph's native view instead of rendering an empty or misleading canvas.
export function coerceView(view: QueryView, capabilityId: string | null | undefined, mode: string | null | undefined): QueryView {
  const views = viewsFor(capabilityId, mode);
  return views.includes(view) ? view : views[0];
}
