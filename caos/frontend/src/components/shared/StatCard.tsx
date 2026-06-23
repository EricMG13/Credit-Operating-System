// Shared stat card: a value with a label and an optional sub-line, with an
// optional severity tint on its border + value color. One source for the
// hand-rolled KPI / metric cards in the Deep-Dive ModuleView and Covenants tab.
// Severity tint goes through sevSurface() — which fixes the latent
// `color + "44"` bug that silently dropped the tint for CSS-var severities.
// Phase 0 foundation — adopted across surfaces in Phase 1.

import { sevSurface } from "@/lib/pipeline/sev";

export function StatCard({
  value,
  label,
  sub,
  sev,
  size = "metric",
  className = "",
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  sub?: React.ReactNode;
  /** Severity token (e.g. "critical" | "warning" | "success"); omit for neutral. */
  sev?: string;
  size?: "metric" | "hero";
  className?: string;
}) {
  const tint = sev ? sevSurface(sev) : null;
  const valueTitle = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  return (
    <div
      className={"rounded border bg-caos-bg px-3 py-2 min-w-0 " + className}
      style={tint ? { borderColor: tint.borderColor } : undefined}
    >
      <div
        className={"tabular truncate " + (size === "hero" ? "text-caos-hero" : "text-caos-metric")}
        style={{ color: tint ? tint.color : "var(--caos-text)" }}
        title={valueTitle}
      >
        {value}
      </div>
      <div className="text-caos-sm text-caos-muted mt-0.5">{label}</div>
      {sub ? <div className="tabular text-caos-2xs text-caos-muted mt-0.5">{sub}</div> : null}
    </div>
  );
}
