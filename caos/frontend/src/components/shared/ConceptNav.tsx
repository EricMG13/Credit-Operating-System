"use client";

// Concept switcher — the five A–E section links, shown in every sub-header so
// users can jump between concepts from anywhere. `compact` renders letter-only
// chips (with tooltips) for the dense concept-page headers; the directory uses
// the full-label variant.

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/command", k: "A", label: "Command Center" },
  { href: "/pipeline", k: "B", label: "Pipeline" },
  { href: "/deepdive", k: "C", label: "Deep-Dive" },
  { href: "/model", k: "D", label: "Model Builder" },
  { href: "/reports", k: "E", label: "Report Studio" },
];

export function ConceptNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 shrink-0" title="Tip: hold SPACE + ← / → to switch concepts">
      {SECTIONS.map((s) => {
        const active = pathname.startsWith(s.href);
        return (
          <Link
            key={s.k}
            href={s.href}
            title={s.label}
            className={
              "no-underline tabular text-[9.5px] px-2 py-1 rounded border transition-caos whitespace-nowrap " +
              (active
                ? "bg-caos-elevated text-caos-text border-caos-accent"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
            }
          >
            <span className="text-caos-accent">{s.k}</span>
            {compact ? null : <span className="ml-1">{s.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
