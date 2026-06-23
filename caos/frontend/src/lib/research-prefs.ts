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

export function loadPrefs(): ResearchPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
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
