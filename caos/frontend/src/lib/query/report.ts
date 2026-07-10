// The running report for the Query concept (layout F). As the analyst explores —
// asks a question, accepts a link, pins an insight — sections accumulate here into
// one exportable committee report. Pure state helpers, no React, no I/O: the rail
// is a thin projector over this list, and the print sheet reads it verbatim.
//
// Every section is grounded: an `answer` carries its cited chunks, an `insight`
// its evidence, a `link` the two issuers it joins. Nothing here is fabricated —
// the section is only ever built from data already rendered on the surface.

export type ReportSectionKind = "answer" | "insight" | "link" | "exhibit";

export interface ReportSource {
  label: string;
  chunk_id?: string | null;
}

export interface ReportSection {
  id: string; // stable dedupe key — `${kind}:${slug}`
  kind: ReportSectionKind;
  title: string;
  body: string;
  sources: ReportSource[];
  capabilityId?: string;
  ai: boolean; // AI-written prose vs deterministic exhibit — drives the print marking
  addedAt: number;
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);

export const sectionId = (kind: ReportSectionKind, key: string): string => `${kind}:${slug(key)}`;

// Append a section, deduped by id. A repeat (same question re-asked, same link
// re-pinned) refreshes the existing section in place rather than stacking a
// duplicate — the report stays one-per-finding.
export function addSection(list: ReportSection[], section: ReportSection): ReportSection[] {
  const without = list.filter((s) => s.id !== section.id);
  return [...without, section];
}

export function removeSection(list: ReportSection[], id: string): ReportSection[] {
  return list.filter((s) => s.id !== id);
}

// localStorage key for the running report. The report is the single most
// valuable artifact the surface produces — a whole session of assembled
// answers, pinned insights, and ratified links — so it survives a refresh,
// crash, or accidental navigation, mirroring the history-persistence pattern.
export const REPORT_STORAGE_KEY = "caos:query-report";

// Structural guard for a rehydrated section — a hand-edited or version-skewed
// localStorage blob must never crash the mount. Drops anything that doesn't
// carry the fields the rail and print sheet read.
function isReportSection(x: unknown): x is ReportSection {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    (s.kind === "answer" || s.kind === "insight" || s.kind === "link" || s.kind === "exhibit") &&
    typeof s.title === "string" &&
    typeof s.body === "string" &&
    Array.isArray(s.sources) &&
    typeof s.ai === "boolean" &&
    typeof s.addedAt === "number"
  );
}

// Parse a persisted report, keeping only well-formed sections. Returns [] on
// any corruption so a bad blob degrades to an empty rail, never a thrown mount.
export function parseStoredReport(raw: string | null): ReportSection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isReportSection) : [];
  } catch {
    return [];
  }
}

const KIND_LABEL: Record<ReportSectionKind, string> = {
  answer: "Answer",
  insight: "Insight",
  link: "Connection",
  exhibit: "Exhibit",
};

export const kindLabel = (k: ReportSectionKind): string => KIND_LABEL[k];
