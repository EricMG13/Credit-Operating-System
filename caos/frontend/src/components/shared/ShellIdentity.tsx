"use client";

import { ConceptNav } from "./ConceptNav";

function Divider() {
  return <div className="h-4 w-px shrink-0 bg-caos-border" aria-hidden="true" />;
}

export function ShellIdentity({
  tag,
  badges,
  title,
  children,
  showConceptNav = true,
  titleAs: Title = "span",
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
  /** Overlays already sit inside a routed surface and do not repeat global concept navigation. */
  showConceptNav?: boolean;
  /** Preserve the route's document outline when the identity is also its visible heading. */
  titleAs?: "span" | "h1" | "h2";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {showConceptNav ? <ConceptNav compact /> : null}
      {tag && (
        <>
          <Divider />
          <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap shrink-0">
            {tag}
          </span>
        </>
      )}
      {/* Badges shrink and truncate before the title does — a non-shrinking
          badge (e.g. a model id) in this no-wrap row otherwise pushes the
          strip into its overflow-hidden clip at narrow desktop widths. */}
      {badges ? <span className="flex min-w-0 shrink items-center gap-3 overflow-hidden">{badges}</span> : null}
      {title && (
        <Title
          title={typeof title === "string" ? title : undefined}
          className="text-caos-sm font-semibold text-caos-text whitespace-nowrap min-w-0 truncate m-0"
        >{title}</Title>
      )}
      {children}
    </div>
  );
}
