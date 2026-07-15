// Display lexicon for status/classification enums. Raw engine literals
// ("screen-only") must never render beside their own humanized twins
// ("Screen only") — one mapping, used everywhere the enum surfaces.

/** "screen-only" → "Screen-only", "actionable" → "Actionable". Unknown values
 *  pass through unchanged so a new enum never renders as an empty string. */
export function classificationLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/** One line for recommendation + classification. When both normalize to the
 *  same token ("Screen only" + "screen-only"), render it once — the
 *  "SCREEN ONLY · SCREEN-ONLY" stutter is a rendering bug, not information. */
export function recommendationLine(recommendation: string, classification: string): string {
  if (normalize(recommendation) === normalize(classification)) return classificationLabel(classification);
  return `${recommendation} · ${classificationLabel(classification)}`;
}
