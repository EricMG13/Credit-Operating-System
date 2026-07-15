// One provenance grammar for every surface — three orthogonal axes:
//
//   Origin:    LIVE / REFERENCE / DEMO   (where the figures come from)
//   Freshness: CURRENT / DUE / STALE / UNKNOWN (how old they are)
//   Method:    REPORTED / DERIVED / MODELLED (how they were produced)
//
// Replaces the per-surface vocabularies (Research's DEMO/●LIVE chips, Query's
// AI-Generated/Deterministic, Model's CP-1 LIVE/SEEDED, Sector Review's
// Seed/demo badge) so an analyst reads ONE grammar everywhere.
//
// Mapping rule (RT-2026-07-11-65, red-team signed): legacy copy saying
// demo/sample/illustrative → DEMO; curated reference fixtures/templates →
// REFERENCE; LIVE strictly requires a genuine live run id / engine flag and is
// NEVER inferred. An omitted axis renders nothing — absence of freshness must
// not read as CURRENT.

// Seam policy (design remediation 2026-07-15): (1) decision-bearing surfaces
// suppress seeded values when live is empty — the Command pattern; (2) where a
// seeded replay/showcase IS the surface's content, every seeded number in
// shared chrome is labeled at the value level (Replay/DEMO + tooltip), never a
// bare figure beside a live-derived zero.

export type ProvOrigin = "LIVE" | "REFERENCE" | "DEMO";
export type ProvFreshness = "CURRENT" | "DUE" | "STALE" | "UNKNOWN";

/** Method semantics: REPORTED = a figure lifted from a source disclosure;
 *  DERIVED = a deterministic transform of reported data (roll-ups, ratios);
 *  MODELLED = an LLM or analytical estimate. Callers that KNOW the method must
 *  set it explicitly — `impliedMethod` exists only as the printed-block
 *  fallback when a producer never declared one. */
export type ProvMethod = "REPORTED" | "DERIVED" | "MODELLED";

/** Fallback when a caller never set method: LIVE figures default DERIVED
 *  (deterministic transform of reported data); REFERENCE/DEMO fixtures default
 *  MODELLED. One rule, so Command and Monitor can never disagree on the
 *  fallback vocabulary. */
export function impliedMethod(origin: ProvOrigin): ProvMethod {
  return origin === "LIVE" ? "DERIVED" : "MODELLED";
}

export interface Provenance {
  origin: ProvOrigin;
  freshness?: ProvFreshness;
  method?: ProvMethod;
  /** The precise sentence behind the chip — surfaces as the tooltip. */
  detail?: string;
  /** Display-ready as-of stamp, appended to the tooltip. */
  asOf?: string;
}

/** Sector Review / digest style "seed" | "live" flags. Unknown vocabulary
 *  returns null so callers keep their bespoke rendering instead of guessing. */
export function fromSeedFlag(v: string | null | undefined): Provenance | null {
  if (v === "seed") return { origin: "DEMO", detail: "Seeded demo fixture — not live output." };
  if (v === "live") return { origin: "LIVE" };
  return null;
}

/** Model Builder engine state → grammar. LIVE only with a real anchored run. */
export function fromModelEngine(eng: {
  live: boolean;
  anchor: unknown;
  runId?: string | null;
}): Provenance {
  if (eng.live && eng.anchor) {
    return {
      origin: "LIVE",
      method: "REPORTED",
      detail: `Anchored to live CP-1${eng.runId ? ` from run ${eng.runId}` : ""}.`,
    };
  }
  return { origin: "DEMO", detail: "No completed run found — seeded demo model (offline fallback)." };
}

/** Deep Research job result → grammar. The narrative is always an LLM
 *  synthesis of the cited web sources — never a literal reported figure — so
 *  method is MODELLED even when the run is genuinely live; only origin and
 *  freshness move. Demo fixtures carry UNKNOWN freshness rather than a
 *  fabricated CURRENT (a static fixture has no real "as of" moment). */
export function fromResearchResult(result: { demo: boolean; truncated?: boolean }): Provenance {
  if (result.demo) {
    return {
      origin: "DEMO",
      method: "MODELLED",
      freshness: "UNKNOWN",
      detail: "Seeded demo narrative — not a live web-research run.",
    };
  }
  return {
    origin: "LIVE",
    method: "MODELLED",
    freshness: "CURRENT",
    detail: result.truncated
      ? "Live web research — narrative truncated by the output limit. Verify against cited sources."
      : "Live web research — AI-synthesized narrative. Verify against cited sources.",
  };
}

/** Report Studio caveat variants → grammar. loading/error/noRun return null —
 *  origin is UNKNOWN there and the page's precise prose carries the state;
 *  a guessed chip would be a relabel. */
export function fromReportCaveat(
  kind: "reference" | "loading" | "error" | "live" | "noRun",
  liveRunBacked: boolean,
): Provenance | null {
  if (kind === "reference") {
    return {
      origin: "REFERENCE",
      detail: liveRunBacked
        ? "Reference template — bespoke tabs stay the Atlas Forge fixture; other figures reflect the live run."
        : "Atlas Forge reference template — not a live issuer run.",
    };
  }
  if (kind === "live") {
    return {
      origin: "LIVE",
      detail: "Live engine modules reflect this issuer; CP-RENDER is not wired to issuer-specific report pages yet.",
    };
  }
  return null;
}
