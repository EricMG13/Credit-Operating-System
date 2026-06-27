// Shared monochrome glyph set — replaces colored emoji in product chrome
// (e.g. the lock in the Deep-Dive module launcher) with drawn marks that
// inherit currentColor and sit in the same geometric vocabulary as the rest of
// the terminal. Honors `.impeccable.md`: no emoji in product chrome.
// Phase 0 foundation.

export function StatusGlyph({
  kind,
  size = 9,
  className = "",
}: {
  kind: "locked" | "warning" | "critical" | "success" | "running" | "idle" | "blocked" | "held";
  size?: number;
  className?: string;
}) {
  if (kind === "locked") {
    return (
      <svg
        viewBox="0 0 12 12"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={"shrink-0" + (className ? " " + className : "")}
      >
        <rect x="2.4" y="5.4" width="7.2" height="4.8" rx="1" />
        <path d="M4 5.4V4.1a2 2 0 0 1 4 0v1.3" />
      </svg>
    );
  }
  if (kind === "warning") {
    // Warning triangle — replaces the ⚠ emoji; inherits currentColor and sits
    // inline next to text (verticalAlign nudge), so the existing warning/critical
    // color still carries the semantic, now paired with a controlled glyph.
    return (
      <svg
        viewBox="0 0 12 12"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={"inline-block shrink-0" + (className ? " " + className : "")}
        style={{ verticalAlign: "-0.12em" }}
      >
        <path d="M6 1.7 11.1 10.5H0.9z" />
        <path d="M6 5v2.3" />
        <path d="M6 9h.01" />
      </svg>
    );
  }
  // Severity/state glyphs so a status dot's meaning is never carried by color
  // alone (Dot pairs these with its color). All inherit currentColor, share the
  // 12×12 box, and sit inline next to text.
  const base = {
    viewBox: "0 0 12 12",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor" as const,
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "inline-block shrink-0" + (className ? " " + className : ""),
    style: { verticalAlign: "-0.12em" as const },
  };
  if (kind === "success") {
    // check mark — pass / cleared
    return <svg {...base}><path d="M2.4 6.3 5 8.9 9.6 3.4" /></svg>;
  }
  if (kind === "critical" || kind === "blocked") {
    // ✕ in a ring — critical / blocked
    return <svg {...base}><circle cx="6" cy="6" r="4.4" /><path d="M4.3 4.3 7.7 7.7M7.7 4.3 4.3 7.7" /></svg>;
  }
  if (kind === "running") {
    // open arc — in progress (pairs with the pulse on live nodes)
    return <svg {...base}><path d="M10 6a4 4 0 1 1-1.2-2.85" /><path d="M10 2.2V4.4H7.8" /></svg>;
  }
  if (kind === "held") {
    // pause bars — held
    return <svg {...base} strokeWidth={1.6}><path d="M4.3 3.2v5.6M7.7 3.2v5.6" /></svg>;
  }
  if (kind === "idle") {
    // hollow dot — idle / queued / not produced
    return <svg {...base}><circle cx="6" cy="6" r="3.4" /></svg>;
  }
  return null;
}
