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
  kind: "locked" | "warning";
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
  return null;
}
