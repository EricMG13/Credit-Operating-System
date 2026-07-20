"use client";

import Link from "next/link";
import { useCurrentAppHref, useDataMode, withDataMode } from "@/lib/data-mode";

export function DataModeMarker() {
  const mode = useDataMode();
  if (mode !== "reference") return null;
  return (
    <span
      className="caos-data-mode-marker inline-flex shrink-0 items-center rounded-sm border border-caos-warning/60 bg-caos-warning/5 px-1.5 py-0.5 tabular text-caos-2xs font-semibold uppercase tracking-wider text-caos-warning"
      role="status"
    >
      REFERENCE · seeded, not issuer data
    </span>
  );
}

export function OpenReferenceExample({
  href,
  className = "caos-action-secondary no-underline focus-ring",
}: {
  href?: string;
  className?: string;
}) {
  const currentHref = useCurrentAppHref();
  return (
    <Link href={withDataMode(href ?? currentHref, "reference")} className={className}>
      Open reference example
    </Link>
  );
}
