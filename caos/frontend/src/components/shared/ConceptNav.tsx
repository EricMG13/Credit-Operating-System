"use client";

// Concept switcher — the concept links, shown in every sub-header so users
// can jump between concepts from anywhere. `compact` renders icon-only chips
// (with tooltips) for the dense concept-page headers; the directory uses the
// icon+label variant. Glyphs are small inline SVGs (stroke = currentColor) — no
// icon-font dependency, consistent with the terminal chrome. The original
// five-concept scheme grew a sixth (Monitor) and a seventh (Compare), so chips
// key off an icon, not an A–E letter.

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  compare: svg(<><rect x="1.8" y="2.4" width="4" height="9.2" rx="1" /><rect x="8.2" y="2.4" width="4" height="9.2" rx="1" /></>),
};

const SECTIONS = [
  { href: "/command", icon: "command", label: "Command" },
  { href: "/pipeline", icon: "pipeline", label: "Pipeline" },
  { href: "/deepdive", icon: "deepdive", label: "Deep-Dive" },
  { href: "/model", icon: "model", label: "Model" },
  { href: "/reports", icon: "report", label: "Report" },
  { href: "/monitor", icon: "monitor", label: "Monitor" },
  { href: "/compare", icon: "compare", label: "Compare" },
];

export function ConceptNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 shrink-0" title="Tip: hold SPACE + ← / → to switch concepts">
      {SECTIONS.map((s) => {
        const active = pathname.startsWith(s.href);
        const Glyph = ICONS[s.icon];
        return (
          <Link
            key={s.href}
            href={s.href}
            title={s.label}
            aria-label={s.label}
            className={
              "no-underline flex items-center gap-1.5 tabular text-[9.5px] px-2 py-1 rounded border transition-caos whitespace-nowrap " +
              (active
                ? "bg-caos-elevated text-caos-text border-caos-accent"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
            }
          >
            <Glyph className={active ? "text-caos-accent" : ""} />
            {compact ? null : <span>{s.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
