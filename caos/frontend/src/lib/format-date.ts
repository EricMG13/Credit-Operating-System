// Date/time sibling to format.ts. One desk standard so as-of stamps never
// drift by locale: authority/observation timestamps render explicit UTC
// ("2026-07-15 19:27 UTC"), date-only stamps render ISO ("2026-07-15"), and
// only analyst-personal stamps (checkpoint saves, history entries) may render
// viewer-local time — locale-pinned so day/month ordering never varies.
// Invalid/null/empty input renders an em dash, matching format.ts.

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const utcDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const utcDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Authority/as-of stamp: "2026-07-15 19:27 UTC". Invalid/null → "—". */
export function fmtUtcDateTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  // en-CA yields "2026-07-15, 19:27"; normalize the separator.
  return utcDateTime.format(d).replace(", ", " ") + " UTC";
}

/** Date-only stamp: "2026-07-15" (accepts ISO date or datetime). Invalid → "—". */
export function fmtUtcDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? utcDate.format(d) : "—";
}

/** Analyst-personal stamp (checkpoint saves, local history): "15 Jul 2026, 14:05"
 *  in the viewer's timezone but locale-pinned to en-GB so ordering is stable.
 *  `timeZone` is injectable for deterministic tests. Invalid/null → "—". */
export function fmtLocalDateTime(
  v: string | number | Date | null | undefined,
  opts?: { timeZone?: string },
): string {
  const d = toDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(opts?.timeZone ? { timeZone: opts.timeZone } : {}),
  }).format(d);
}
