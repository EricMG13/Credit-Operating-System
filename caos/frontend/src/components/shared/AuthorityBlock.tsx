// The shared printed authority line — Origin / Method / Freshness / QA —
// rendered on every "paper" deliverable (Report Studio's IC memo, Deep
// Research's tear-sheet) so a printed PDF states its own evidence basis on
// its face instead of relying on app chrome the reader may never have seen.
//
// Takes a Provenance object directly (lib/provenance.ts), the same grammar
// ProvenanceChip renders on-screen — callers compute the mapping for their
// own state model (fromReportCaveat, fromResearchResult, ...) and pass the
// result here. `prov === null` means the caller could not establish
// provenance at all (loading/error/no-run) — `unknownText` is the caller's
// own honest explanation for that state, never guessed by this component.
//
// Deliberately does NOT reuse the dark-UI ProvenanceChip — every paper
// surface is ink-on-cream by design (CLAUDE.md's "deliberate counterpoint");
// the SAME three-axis grammar renders in the paper's own mono/ink vocabulary
// instead of transplanting a dark terminal chip onto cream paper.

import { impliedMethod, type Provenance } from "@/lib/provenance";

export function AuthorityBlock({
  prov,
  unknownText,
  runId,
  qaNote,
  approval,
}: {
  prov: Provenance | null;
  /** Rendered verbatim when prov is null. Required in practice — every
   *  current caller supplies one for its unknown branch. */
  unknownText?: string;
  runId?: string | null;
  qaNote?: string | null;
  /** Explicit conclusion authority. Defaults to the caller's QA note, then
   * UNRATIFIED — origin/freshness never imply committee approval. */
  approval?: string | null;
}) {
  const unknown = !prov;

  const text = prov
    ? [
        `ORIGIN: ${prov.origin}`,
        // Method: prefer the caller's explicit method (e.g. Deep Research's
        // narrative is MODELLED even when the run is LIVE — an LLM synthesis,
        // never a literal reported figure). Only fall back to the
        // origin-implied default when the caller didn't set one.
        `METHOD: ${prov.method ?? impliedMethod(prov.origin)}`,
        `APPROVAL: ${approval || qaNote || "UNRATIFIED"}`,
        prov.freshness ? `FRESHNESS: ${prov.freshness}` : null,
        runId ? `RUN: ${runId.slice(0, 8)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : unknownText || "ORIGIN: UNKNOWN";

  return (
    <div
      role="note"
      title={prov?.detail}
      className="rd-authority"
      style={{
        margin: "6px 0",
        padding: "4px 8px",
        border: `1px solid ${unknown ? "var(--caos-critical)" : "#16161e"}`,
        color: unknown ? "#b91c1c" : "#16161e",
        fontSize: "10px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {text}
    </div>
  );
}
