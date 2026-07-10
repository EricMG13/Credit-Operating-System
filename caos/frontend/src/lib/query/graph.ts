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
  availability: Record<string, boolean>; // includes model_lane — LLM lanes usable at all
}

// ── Model lanes (routes/query.py /route + /overlay) ──────────────────────────

export interface RouteCandidate {
  id: string;
  label: string;
  enabled: boolean;
  reason: string;
}

export interface RouteResult {
  candidates: RouteCandidate[];
  source: "llm" | "keyword"; // keyword = degrade contract: use the local router
}

export interface OverlayEdge {
  source: string;
  target: string;
  rationale: string;
  chunk_ids: string[];
  confidence: "High" | "Medium" | "Low";
}

export interface OverlayResult {
  edges: OverlayEdge[];
  commentary: string;
  suggested_walks: string[];
  capability_id: string;
  model: string | null;
  created_at: string | null;
  cached: boolean;
}

// An analyst-ratified model-proposed link (phase 3) — stored, attributed,
// drawn by the deterministic builders as edge kind "accepted".
export interface AcceptedLink {
  id: string;
  issuer_a: string;
  issuer_b: string;
  capability_id: string;
  rationale: string;
  chunk_ids: string[];
  confidence: string;
  model: string;
  analyst_id: string | null;
  created_at: string | null;
}

// Normalized undirected pair key — mirrors the server's (issuer_a < issuer_b).
export const pairKey = (a: string, b: string): string => [a, b].sort().join("|");

// ── Desk Brief (routes/query.py /insights) — proactive AI research, marked ────
// Cited, AI-written insight cards over what changed in the book. Every card cites
// a real evidence entry; ungrounded cards are dropped server-side, so anything
// rendered here is grounded. `chunk_id` (when set) opens the citation viewer,
// else the card deep-links `walk`.
export interface InsightEvidence {
  id: string;
  label: string;
  chunk_id: string | null;
}

export interface InsightCard {
  id: string;
  headline: string;
  detail: string;
  walk: string | null;
  issuer_id: string | null;
  evidence: InsightEvidence[];
}

export interface InsightBrief {
  cards: InsightCard[];
  degraded: boolean; // true = deterministic highlights (no model / nothing groundable)
  generated_reason: string;
  data_fingerprint: string;
  model: string | null;
  generated_at: string | null;
  cached: boolean;
  refreshing: boolean; // a background regeneration is in flight — poll for the AI brief
  available: boolean; // model lane usable; false → the client hides the panel
}

// ── Grounded answer (routes/query.py /answer) — cited AI prose beside a walk ──
export interface AnswerCitation {
  chunk_id: string;
  label: string;
}

export interface AnswerSentence {
  text: string;
  chunk_ids: string[];
}

export interface AnswerResult {
  answer: string; // survivor sentences joined; "" when unavailable
  sentences: AnswerSentence[];
  citations: AnswerCitation[];
  unavailable: boolean;
  reason?: string;
  model: string | null;
  created_at: string | null;
  cached: boolean;
}
