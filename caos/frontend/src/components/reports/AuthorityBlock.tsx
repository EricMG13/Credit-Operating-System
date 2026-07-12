// The printed authority line — Origin / Method / Freshness / QA — derived
// deterministically from the same caveatKind the on-screen header already
// uses (lib/provenance.ts fromReportCaveat), never guessed. Rendered inside
// ReportDoc, which is instantiated BOTH on-screen and inside PrintPortal, so
// one injection point covers both surfaces the plan calls for (P2-WP-8).
//
// Deliberately does NOT reuse the dark-UI ProvenanceChip here — Report
// Studio's paper is ink-on-cream by design (CLAUDE.md's "deliberate
// counterpoint"); the SAME grammar is rendered in the paper's own mono/ink
// vocabulary instead of transplanting a dark terminal chip onto cream paper.
//
// error/loading/noRun carry no real Provenance (fromReportCaveat returns
// null for them, same as the header) — rather than fabricate one, this
// prints an explicit ORIGIN: UNKNOWN line so the deliverable never overstates
// its own certainty.

import type { DeepDiveCaveatKind } from "@/lib/deepdive/caveat";
import { fromReportCaveat } from "@/lib/provenance";

const UNKNOWN_TEXT: Record<"loading" | "error" | "noRun", string> = {
  loading: "ORIGIN: UNKNOWN — checking for a live issuer run",
  error: "ORIGIN: UNKNOWN — could not confirm live-run status",
  noRun: "ORIGIN: UNKNOWN — no completed run for this issuer",
};

export function AuthorityBlock({
  caveatKind,
  liveRunBacked,
  runId,
  qaNote,
}: {
  caveatKind: DeepDiveCaveatKind;
  liveRunBacked: boolean;
  runId?: string | null;
  qaNote?: string | null;
}) {
  const prov = fromReportCaveat(caveatKind, liveRunBacked);
  const unknown = !prov && caveatKind !== "reference" && caveatKind !== "live";

  const text = prov
    ? [
        `ORIGIN: ${prov.origin}`,
        // Method: the committee narrative is analyst/LLM-synthesized around a
        // fixture (MODELLED) vs computed straight from a live run's module
        // outputs (DERIVED) — never fabricated, always one of the two known
        // production paths for this document.
        `METHOD: ${prov.origin === "LIVE" ? "DERIVED" : "MODELLED"}`,
        runId ? `RUN: ${runId.slice(0, 8)}` : null,
        qaNote,
      ]
        .filter(Boolean)
        .join(" · ")
    : UNKNOWN_TEXT[caveatKind as "loading" | "error" | "noRun"];

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
