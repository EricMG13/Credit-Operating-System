// DTOs for the Query concept's graph engine (caos/server/engine/querygraph.py +
// routes/query.py). snake_case mirrors the FastAPI response verbatim. Positions
// (x, y) are normalized 0..1 — the renderer scales them into the viewBox.

export interface GraphNode {
  id: string;
  label: string;
  kind: string; // center | issuer | sector | driver | module | claim | evidence | chunk | metric | point-bull | point-bear | finding-crit|mat|min
  x: number;
  y: number;
  sub?: string;
  group?: string | null; // industry/country — drives categorical color
  center?: boolean;
  exposed?: boolean;
  dim?: boolean;
  flag?: boolean;
  compact?: boolean; // cluster member: small dot, name on hover only
  confidence?: string;
  weight?: number;
  chunk_id?: string; // present on chunk nodes → click-to-source
  module?: string | null;
  title?: string; // hover detail
  obsidian_url?: string;
  analyst_excerpt?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
  kind?: string; // dep | cite | driver | member | seq | bull | bear | finding
}

export interface GraphResult {
  capability_id: string;
  mode: string; // peers | contagion | concentration | provenance
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: string[];
  caveats: string[];
}

export interface Capability {
  id: string;
  label: string;
  mode: string;
  enabled: boolean;
  reason: string | null; // why greyed, when disabled
}

export interface CapabilityGroup {
  id: string;
  label: string;
  icon: string;
  ready: number;
  total: number;
  capabilities: Capability[];
}

export interface CapabilitiesResult {
  groups: CapabilityGroup[];
  availability: Record<string, boolean>;
}
