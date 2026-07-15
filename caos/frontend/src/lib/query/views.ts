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

// Capability-first overrides, so the NATIVE (first) view fits the walk's actual
// shape. List-shaped walks (a ranked peer set, a handful of concentration
// clusters, a note list of memos) read as a table first — a sparse node-link
// graph buries the ranking they exist to convey — with graph kept one click away
// for the cases where topology is genuinely the answer. Scatter is the only
// honest metric-axis plot, so it stays scatter-native.
const BY_CAP: Record<string, QueryView[]> = {
  scatter: ["scatter", "rv"],
  "peer-set": ["rv", "graph"],
  "concentration-map": ["rv", "graph"],
  // Rating distribution is a bucket table first (IG/BB/B/CCC), hub-graph second.
  "rating-distribution": ["rv", "graph"],
  // Portfolio exposure is a sector-concentration cluster graph first, table second.
  "portfolio-exposure": ["graph", "rv"],
  // Memos are a note list with no lineage edges — Lineage renders empty columns,
  // so this override lands before BY_MODE provenance's trace-native default.
  "analyst-memos": ["rv", "graph"],
  // A covenant register is a table of names × covenant terms first; hub-graph second.
  "covenant-register": ["rv", "graph"],
  // Head-to-head is a table of compared rows (metric x two issuers) first;
  // hub-graph second — same shape as covenant-register.
  "head-to-head": ["rv", "graph"],
  // Sponsor is a hub topology, not a lineage trace — pin it to graph, never the
  // "trace" renderer its provenance mode would otherwise default to.
  "sponsor-graph": ["graph", "rv"],
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
