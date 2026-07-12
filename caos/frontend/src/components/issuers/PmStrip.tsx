"use client";

// The PM ten-second answer for Issuer Profile: posture / what changed / risk
// / evidence health / action, composed ONLY from the already-fetched
// IssuerProfile response (no new compute, no LLM — a read-model, per the
// locked Issuer Profile decision). Purely presentational; the caller (role
// view gate) decides when it mounts and supplies every field. Every cell
// renders an explicit "—" placeholder rather than hiding when a value is
// genuinely absent (status honesty, same rule as DecisionHeader).

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-1.5 border-r border-caos-border last:border-r-0 max-lg:border-r-0 max-lg:border-b max-lg:last:border-b-0">
      <div className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">{label}</div>
      <div className="tabular text-caos-xs text-caos-text truncate">{children}</div>
    </div>
  );
}

const SEV_COLOR: Record<string, string> = {
  critical: "var(--caos-critical)",
  warning: "var(--caos-warning)",
  ok: "var(--caos-success)",
  low: "var(--caos-muted)",
};

export function PmStrip({
  posture,
  whatChanged,
  risk,
  evidenceHealth,
  action,
}: {
  posture: { label: string; sev: string } | null;
  whatChanged: string;
  risk: string;
  evidenceHealth: { label: string; sev: string };
  action: { label: string; href: string };
}) {
  return (
    <section
      aria-label="PM summary"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 border border-caos-border rounded bg-caos-panel/40"
    >
      <Cell label="Posture">
        {posture ? (
          <span style={{ color: SEV_COLOR[posture.sev] ?? "var(--caos-text)" }}>{posture.label}</span>
        ) : (
          <span className="text-caos-muted">—</span>
        )}
      </Cell>
      <Cell label="What changed">{whatChanged || <span className="text-caos-muted">—</span>}</Cell>
      <Cell label="Risk">{risk || <span className="text-caos-muted">—</span>}</Cell>
      <Cell label="Evidence health">
        <span style={{ color: SEV_COLOR[evidenceHealth.sev] ?? "var(--caos-text)" }}>{evidenceHealth.label}</span>
      </Cell>
      <Cell label="Action">
        <a href={action.href} className="text-caos-accent hover:text-caos-text transition-caos focus-ring rounded outline-none">
          {action.label} →
        </a>
      </Cell>
    </section>
  );
}
