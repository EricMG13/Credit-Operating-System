"use client";

// Wraps a live value and briefly flashes when it changes — the trading-desk
// "what changed" cue. Motion only for life: it fires on genuine value changes
// (live runs / intake), and the flash animation is disabled under
// prefers-reduced-motion (see .caos-flash in globals.css).

import { useEffect, useRef, useState } from "react";

export function FlashOnChange({
  value,
  children,
  className = "",
}: {
  /** The tracked value — a change vs. the previous render triggers the flash. */
  value: string | number;
  children: React.ReactNode;
  className?: string;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);
  return <span className={(flash ? "caos-flash " : "") + className}>{children}</span>;
}
