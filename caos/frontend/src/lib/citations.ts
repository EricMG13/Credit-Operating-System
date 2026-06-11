// Pure, dependency-free parser for inline `[[cite:n]]` citation markers in
// agent-authored narrative. Kept separate from React so it is unit-testable
// and so malformed LLM output can never break rendering (Blueprint §7.1).

export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "cite"; index: number; raw: string };

const CITE_RE = /\[\[cite:(\d+)\]\]/g;

/**
 * Split narrative text into ordered text / citation segments.
 *
 * Hardened against malformed model output:
 *  - `[[cite:]]` (no digits) does not match → stays inert text
 *  - `[[cite:99]]` parses to index 99 (caller decides if it resolves)
 *  - nested/garbage brackets leave unmatched fragments as inert text
 *  - non-string / empty input returns []
 *
 * Never throws.
 */
export function parseCitations(input: unknown): CitationSegment[] {
  if (typeof input !== "string" || input.length === 0) return [];

  const out: CitationSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CITE_RE.lastIndex = 0;

  while ((m = CITE_RE.exec(input)) !== null) {
    if (m.index > last) out.push({ type: "text", value: input.slice(last, m.index) });
    out.push({ type: "cite", index: Number(m[1]), raw: m[0] });
    last = m.index + m[0].length;
    // Guard against zero-length matches (defensive; CITE_RE can't produce them).
    if (m.index === CITE_RE.lastIndex) CITE_RE.lastIndex++;
  }
  if (last < input.length) out.push({ type: "text", value: input.slice(last) });
  return out;
}
