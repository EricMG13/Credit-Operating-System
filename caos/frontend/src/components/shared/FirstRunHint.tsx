"use client";

// Dismissible first-run hint: teaches a screen's core interaction once, then
// remembers the dismissal in localStorage so it never nags again. Restrained by
// design — a thin terse callout (desk "TIP", not a splashy product tour) that
// honors the "committee-ready, no noise" brand. Enter motion degrades under
// prefers-reduced-motion (via .caos-enter).

import { useEffect, useState } from "react";

export function FirstRunHint({
  id,
  children,
  className = "",
}: {
  /** Stable key — dismissal is remembered under `caos-hint-<id>`. */
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const key = "caos-hint-" + id;
  // Default hidden so first paint never flashes the hint before we know whether
  // it was dismissed; reveal after the localStorage check.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(key) !== "1"); } catch { setShow(true); }
  }, [key]);
  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(key, "1"); } catch { /* private mode */ }
    setShow(false);
  };
  return (
    <div className={"caos-enter flex items-start gap-2.5 rounded border border-caos-border px-3 py-1.5 " + className}>
      <span className="tabular text-caos-micro uppercase tracking-wider text-caos-accent mt-px shrink-0">Tip</span>
      <div className="text-caos-body text-caos-muted leading-snug flex-1">{children}</div>
      <button
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="shrink-0 rounded text-caos-muted hover:text-caos-text transition-caos text-[11px] focus-ring"
      >
        ✕
      </button>
    </div>
  );
}
