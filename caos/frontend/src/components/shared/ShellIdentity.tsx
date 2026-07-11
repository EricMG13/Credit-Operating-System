"use client";

// The repeated identity cluster for concept sub-headers: "← Directory"
// back-link, the ConceptNav switcher, then an optional CP-code tag and page
// title. Previously copy-pasted (Monitor, Upload) or missing entirely
// (Reports). The title gets `min-w-0 truncate` so under header squeeze the
// TEXT shrinks instead of hard-clipping trailing chrome like Settings and the
// analyst badge (RT-2026-07-11-60).

import Link from "next/link";
import { ConceptNav } from "./ConceptNav";

function Divider() {
  return <div className="h-4 w-px bg-caos-border" aria-hidden="true" />;
}

export function ShellIdentity({
  tag,
  badges,
  title,
  children,
}: {
  /** Small uppercase CP-code tag, e.g. "CP-MON" or "CP-0 · L0". */
  tag?: string;
  /** Must-survive markers (honesty/caveat chips) — rendered BEFORE the title so
      the truncating title yields to them, never the reverse. */
  badges?: React.ReactNode;
  /** Page title — truncates under squeeze rather than clipping the header tail. */
  title?: React.ReactNode;
  /** Nice-to-have identity content after the title; first to be clipped. */
  children?: React.ReactNode;
}) {
  return (
    <>
      <Link
        href="/issuers"
        className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap focus-ring"
      >
        ← Directory
      </Link>
      <Divider />
      <ConceptNav compact />
      {tag && (
        <>
          <Divider />
          <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap shrink-0">
            {tag}
          </span>
        </>
      )}
      {badges}
      {title && (
        <span className="text-caos-text font-medium whitespace-nowrap min-w-0 truncate">{title}</span>
      )}
      {children}
    </>
  );
}
