"use client";

// Concept switcher — every concept link, shown in every sub-header so users
// can jump between concepts from anywhere. Concepts render in workflow groups
// (Intake / Analyze / Decide / Publish / Monitor) from the shared registry in
// lib/nav.ts — the same registry drives the Alt+←/→ cycle order, so the nav
// and the hotkeys can never drift. `compact` (dense concept-page headers)
// labels only the active chip and its group (you-are-here); the rest are
// icon + tooltip, and inactive group labels collapse to separators so the
// 40px strip survives 1280px next to dense page headers. The directory always
// shows full labels. Glyphs are small inline SVGs (stroke = currentColor) — no
// icon-font dependency, consistent with the terminal chrome.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnalystBadge } from "./AnalystBadge";
import { NAV_GROUPS, routeMatches } from "@/lib/nav";

type Icon = (props: { className?: string }) => React.ReactElement;

const svg = (children: React.ReactNode): Icon =>
  function I({ className }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 14 14"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={"shrink-0 " + (className ?? "")}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };

const ICONS: Record<string, Icon> = {
  directory: svg(<>
    <path d="M1.6 3.4h4.2l1 1.4h5.6v6.8H1.6z" />
  </>),
  command: svg(<>
    <rect x="1.6" y="1.6" width="4.3" height="4.3" rx="1" /><rect x="8.1" y="1.6" width="4.3" height="4.3" rx="1" />
    <rect x="1.6" y="8.1" width="4.3" height="4.3" rx="1" /><rect x="8.1" y="8.1" width="4.3" height="4.3" rx="1" />
  </>),
  pipeline: svg(<>
    <path d="M7 3.2v3M7 6.2H3.4v3.4M7 6.2h3.6v3.4" />
    <circle cx="7" cy="2.2" r="1.1" /><circle cx="3.4" cy="11" r="1.1" /><circle cx="10.6" cy="11" r="1.1" />
  </>),
  deepdive: svg(<><circle cx="5.9" cy="5.9" r="3.5" /><path d="M8.7 8.7l3.4 3.4" /></>),
  model: svg(<><rect x="1.8" y="2.6" width="10.4" height="8.8" rx="1" /><path d="M1.8 5.6h10.4M5.4 5.6v5.8" /></>),
  report: svg(<><path d="M3.6 1.9h4.6L11 4.7v7.4H3.6z" /><path d="M5.4 6.6h4M5.4 8.8h4" /></>),
  monitor: svg(<path d="M1.5 7.4h2.6l1.6-4 2.2 7 1.5-3h3.1" />),
  research: svg(<>
    <path d="M5.5 1.8v3.3L2.5 10.8a1 1 0 0 0 .9 1.5h7.2a1 1 0 0 0 .9-1.5L8.5 5.1V1.8" />
    <path d="M4.5 1.8h5M4.4 8.2h5.2" />
  </>),
  query: svg(<>
    <circle cx="7" cy="3.2" r="1.5" /><circle cx="3.2" cy="10.2" r="1.5" /><circle cx="10.8" cy="10.2" r="1.5" />
    <path d="M6.2 4.5 4 8.9M7.8 4.5 10 8.9M4.7 10.2h4.6" />
  </>),
  sector: svg(<>
    <path d="M2 3.2h10M2 7h10M2 10.8h10" />
    <path d="M3.4 1.8v2.8M7 5.6v2.8M10.6 9.4v2.8" />
  </>),
  "sector-rv": svg(<>
    <path d="M1.5 12.5h11M3.5 12.5v-4M7 12.5v-8M10.5 12.5v-6" />
  </>),
  upload: svg(<>
    <path d="M7 9.6V2.4M4.4 5 7 2.4 9.6 5" />
    <path d="M2 9.6v2.2a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V9.6" />
  </>),
  settings: svg(<>
    <circle cx="7" cy="7" r="2.1" />
    <path d="M7 1.5v1.6M7 10.9v1.6M12.5 7h-1.6M3.1 7H1.5M10.9 3.1 9.8 4.2M4.2 9.8l-1.1 1.1M10.9 10.9 9.8 9.8M4.2 4.2 3.1 3.1" />
  </>),
};

export function ConceptNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const Gear = ICONS.settings;
  const settingsActive = pathname.startsWith("/settings");
  return (
    <span className="flex items-center gap-1 shrink-0">
      <nav
        id="concept-nav"
        aria-label="Concepts"
        className="flex items-center gap-1"
        title="Tip: hold ALT + ← / → to switch concepts"
      >
        {NAV_GROUPS.map((g, gIdx) => {
          const groupActive = g.items.some((i) => routeMatches(pathname, i.href));
          // Group labels carry the workflow stage. In compact mode only the
          // active group is labeled (you-are-here); inactive groups collapse
          // to a separator so dense page headers still fit at 1280px (RT-60).
          const showGroupLabel = !compact || groupActive;
          return (
            <span key={g.id} className="flex items-center gap-1">
              {gIdx > 0 && <span className="h-4 w-px bg-caos-border mx-0.5" aria-hidden="true" />}
              {showGroupLabel && (
                <span
                  className="text-caos-2xs uppercase tracking-widest text-caos-muted select-none pl-0.5 pr-0.5"
                  aria-hidden="true"
                  title={g.label}
                >
                  {g.label}
                </span>
              )}
              {g.items.map((s) => {
                // The Directory chip is self-referential (and a wide full-label
                // entry) on /issuers itself, the one page rendering the
                // non-compact nav — drop it there rather than overflow the
                // header; every other page keeps it as the back-link.
                if (!compact && s.href === "/issuers") return null;
                const active = routeMatches(pathname, s.href);
                const Glyph = ICONS[s.icon];
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    title={s.label + " — " + g.label}
                    aria-label={s.label}
                    aria-current={active ? "page" : undefined}
                    className={
                      "no-underline flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 min-h-8 rounded border transition-caos whitespace-nowrap focus-ring " +
                      (active
                        ? "bg-caos-accent text-caos-bg border-caos-accent font-semibold"
                        : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
                    }
                  >
                    <Glyph className={active ? "text-caos-bg" : ""} />
                    {/* Labels: always in the directory (non-compact). Dense
                        concept headers label only the active chip; the rest
                        are icon + tooltip. */}
                    <span className={compact ? (active ? "inline" : "hidden") : "inline"}>{s.label}</span>
                  </Link>
                );
              })}
            </span>
          );
        })}
      </nav>
      {/* Settings is utility chrome, not a concept — kept outside the Concepts nav. */}
      <span className="h-4 w-px bg-caos-border mx-0.5" />
      <Link
        href="/settings"
        title="Settings"
        aria-label="Settings"
        aria-current={settingsActive ? "page" : undefined}
        className={
          "no-underline flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 min-h-8 rounded border transition-caos whitespace-nowrap focus-ring " +
          (settingsActive
            ? "bg-caos-accent text-caos-bg border-caos-accent font-semibold"
            : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
        }
      >
        <Gear className={settingsActive ? "text-caos-bg" : ""} />
        <span className={compact ? (settingsActive ? "inline" : "hidden") : "inline"}>Settings</span>
      </Link>
      {/* Signed-in analyst initials — to the right of the nav on every page. */}
      <span className="h-4 w-px bg-caos-border mx-0.5" />
      <AnalystBadge />
    </span>
  );
}
