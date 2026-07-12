// Per-analyst Deep Research defaults — the standing research lens (scope,
// timeframe, audience, criteria) the analyst doesn't want to retype each run.
// Browser-local (localStorage); no server round-trip. The Settings page edits
// these; the Research page seeds its brief form from them on mount.

export const DEFAULT_CRITERIA = [
  "Macro impact — rates, growth, and the credit-supply backdrop, and how they transmit here",
  "Key structural drivers shaping fundamentals and the credit trajectory",
  "Risk focus — the dominant near-term credit, structural, and liquidity risks",
  "Sector outlook & trends — dispersion, winners/losers, and lender appetite",
  "Credit quality & rating trends — defaults, downgrades, distressed-debt levels",
  "Valuation trends — multiples, LTV, and M&A/refinancing feasibility",
  "Sponsor & lender activity — financing structures, PIK use, dry powder, diligence shifts",
].join("\n");

// AI power preset. Resolved server-side into model + reasoning effort + search
// budget (see deepresearch.py). `standard` = the engine's existing defaults.
export type AiMode = "max" | "standard" | "lite";

export interface ResearchPrefs {
  ai_mode: AiMode;
  mode: "sector" | "issuer";
  audience: string;
  decision: string;
  timeframe: string;
  criteria: string;
}

export const DEFAULT_PREFS: ResearchPrefs = {
  ai_mode: "standard",
  mode: "sector",
  audience: "",
  decision: "",
  timeframe: "",
  criteria: DEFAULT_CRITERIA,
};

const KEY = "caos.research.prefs";

const AI_MODES: readonly AiMode[] = ["max", "standard", "lite"];
const MODES: readonly ResearchPrefs["mode"][] = ["sector", "issuer"];

// Per-field validation against DEFAULT_PREFS's shape — a malformed, stale-schema,
// or hand-edited localStorage value must never inject a wrong-typed field into the
// merged prefs (downstream code trusts this shape without re-checking it). Any
// field that's missing or the wrong type falls back to its own default rather than
// failing the whole load.
function sanitizePrefs(raw: unknown): ResearchPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ai_mode: AI_MODES.includes(r.ai_mode as AiMode) ? (r.ai_mode as AiMode) : DEFAULT_PREFS.ai_mode,
    mode: MODES.includes(r.mode as ResearchPrefs["mode"])
      ? (r.mode as ResearchPrefs["mode"])
      : DEFAULT_PREFS.mode,
    audience: typeof r.audience === "string" ? r.audience : DEFAULT_PREFS.audience,
    decision: typeof r.decision === "string" ? r.decision : DEFAULT_PREFS.decision,
    timeframe: typeof r.timeframe === "string" ? r.timeframe : DEFAULT_PREFS.timeframe,
    criteria: typeof r.criteria === "string" ? r.criteria : DEFAULT_PREFS.criteria,
  };
}

export function loadPrefs(): ResearchPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return DEFAULT_PREFS;
    return sanitizePrefs(JSON.parse(stored));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: ResearchPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — prefs just don't persist */
  }
}
