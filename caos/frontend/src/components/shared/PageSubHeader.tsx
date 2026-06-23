"use client";

// The 40px sub-header strip every concept page wears: "← Directory" back-link,
// the ConceptNav switcher, then page-specific content (title, stats, view
// toggles…) as children. Consolidates the identical left cluster repeated across
// all ten pages. Uses gap-5; the few pages that pack a denser header (Model,
// Report) can grow a `gap` prop when they adopt this.

import Link from "next/link";
import { ConceptNav } from "./ConceptNav";

function Divider() {
  return <div className="h-4 w-px bg-caos-border" />;
}

export function PageSubHeader({ gap = "gap-5", children }: { gap?: string; children?: React.ReactNode }) {
  return (
    <div className={`h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center ${gap} px-4`}>
      <Link
        href="/issuers"
        className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap"
      >
        ← Directory
      </Link>
      <Divider />
      <ConceptNav compact />
      <Divider />
      {children}
    </div>
  );
}
