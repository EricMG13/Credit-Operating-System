"use client";

// Deep-dive side rails: source register + CP-5B evidence trace (left),
// CP-5 clearance + IC verdict + sizing + armed triggers (right)
// (port of design bundle concept-c-app.jsx SourceRail / DecisionRail).

import { DEAL, DEBATE, DOCS, SIZING, TRIGGERS } from "@/lib/reports/deal";
import { DRIVERS } from "@/lib/pipeline/data";
import { Bar, Dot, Tag } from "@/components/pipeline/atoms";
import { Panel } from "@/components/shared/Panel";
import { RailShell } from "@/components/shared/RailShell";
import { useEvidenceSync } from "@/lib/evidence-sync";
import type { FindingDTO } from "@/lib/engine/types";

export { Panel };

// For a non-reference issuer the rails' fixture content (source register, CP-5B
// drivers, IC verdict, sizing, triggers) is the ATLF reference template, not that
// issuer's own analysis — say so loudly so a PM never reads it as this issuer's
// committee decision. The live engine output for the issuer is in the centre pane.
function RefTemplateStrip({ code, onCollapse }: { code?: string; onCollapse?: () => void }) {
  const who = code && code !== "—" ? code : "this issuer";
  return (
    <div role="note" className="bg-caos-panel border rounded-md px-3 py-2 shrink-0" style={{ borderColor: "rgba(245,165,36,0.45)" }}>
      <div className="flex items-center gap-2">
        <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: "var(--caos-warning)" }}>⚠ ATLF reference template</span>
        {onCollapse ? (
          <button onClick={onCollapse} title="Collapse decision rail" aria-label="Collapse decision rail" className="ml-auto text-caos-muted hover:text-caos-text transition-caos text-caos-2xl focus-ring">⊐</button>
        ) : null}
      </div>
      <div className="text-caos-md text-caos-text leading-snug mt-0.5">
        Figures in this rail are the Atlas Forge reference deal, <span className="font-medium">not {who}</span>. Live engine output for {who} is in the centre module views; run the issuer to populate its own register and committee output.
      </div>
    </div>
  );
}

// CP-5C reviewer seats keyed by the audit lane their findings carry
// (engine/council.py). Diversity is by review lens, not vendor.
const SEAT_BY_LANE: Record<number, string> = {
  2: "Numerical Consistency",
  3: "Covenant Construction",
  4: "Evidence Sufficiency",
  5: "Devil's Advocate",
};
// Map a finding severity to a Tag tone (severity text label carries meaning too,
// so this is never color-alone).
const SEV_TAG: Record<string, string> = {
  CRITICAL: "critical",
  MATERIAL: "warning",
  MINOR: "low",
};

// Committee Review (CP-5C): live semantic-review findings, grouped by seat.
// Opt-in on the backend; empty here in the offline/seeded demo, where it
// documents the capability without implying a fault.
function CouncilReview({ council }: { council: FindingDTO[] }) {
  const ordered = [...council].sort(
    (a, b) => (a.lane ?? 99) - (b.lane ?? 99) || a.finding_id.localeCompare(b.finding_id),
  );
  return (
    <Panel title="Committee Review · CP-5C" className="shrink-0">
      {ordered.length === 0 ? (
        <div className="px-3 py-2.5 text-caos-lg text-caos-muted leading-snug">
          No live committee findings. CP-5C runs an adversarial reviewer panel when
          enabled; flagged reasoning surfaces here and gates the run alongside CP-5B.
        </div>
      ) : (
        // fallow-ignore-next-line complexity
        ordered.map((f) => (
          <div key={f.finding_id} className="px-3 py-2 border-b border-caos-border/50">
            <div className="flex items-center gap-2">
              <Tag sev={SEV_TAG[f.severity] || "low"}>{f.severity}</Tag>
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted truncate">
                {SEAT_BY_LANE[f.lane ?? 0] || `Lane ${f.lane ?? "—"}`}
              </span>
            </div>
            <div className="text-caos-lg text-caos-text leading-snug mt-1">{f.description}</div>
            <div className="tabular text-caos-2xs text-caos-muted mt-1 flex gap-2 whitespace-nowrap">
              {f.module_id ? <span>{f.module_id}</span> : null}
              {f.affected_claim_id ? <span>claim {f.affected_claim_id}</span> : null}
            </div>
            {f.required_remediation ? (
              <div className="text-caos-2xs text-caos-muted leading-snug mt-1">
                → {f.required_remediation}
              </div>
            ) : null}
          </div>
        ))
      )}
    </Panel>
  );
}

// fallow-ignore-next-line complexity
export function SourceRail({
  ev,
  open,
  onToggle,
  isReference = true,
  issuerCode,
  issuerName,
}: {
  ev: string | null;
  open: boolean;
  onToggle: () => void;
  isReference?: boolean;
  issuerCode?: string;
  issuerName?: string;
}) {
  const { active, setActive } = useEvidenceSync();
  const code = isReference ? DEAL.code : (issuerCode || "—");
  const name = isReference ? DEAL.name : (issuerName || "Issuer");
  return (
    <RailShell
      open={open}
      onToggle={onToggle}
      expandTitle="Expand source rail"
      glyph="⊐"
      collapsed={
        <>
          <span className="tabular text-caos-md text-caos-accent" style={{ writingMode: "vertical-rl" }}>{code}</span>
          <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted" style={{ writingMode: "vertical-rl" }}>Source register · Evidence trace</span>
        </>
      }
    >
      <div className="bg-caos-panel border border-caos-border rounded-md px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="tabular text-caos-2xl text-caos-accent">{code}</span>
          <span className="text-caos-2xl font-semibold text-caos-text">{name}</span>
          <button onClick={onToggle} title="Collapse source rail" aria-label="Collapse source rail" className="ml-auto text-caos-muted hover:text-caos-text transition-caos text-caos-2xl focus-ring">⊏</button>
        </div>
        {isReference ? (
          <>
            <div className="text-caos-sm text-caos-muted mt-1 leading-relaxed">{DEAL.sector}<br />{DEAL.sponsor}</div>
            <div className="flex gap-3 mt-1.5 tabular text-caos-sm">
              <span className="text-caos-muted">{DEAL.rating}</span>
              <span className="text-caos-text">LTM adj. EBITDA ${DEAL.ebitda}M</span>
              <span className="text-caos-text">{DEAL.netLev}x</span>
            </div>
          </>
        ) : null}
      </div>
      {!isReference ? <RefTemplateStrip code={code} /> : null}
      <Panel title="Source Register · CP-0" className="flex-[2]">
        {DOCS.map((d) => (
          <div key={d.id} className="px-3 py-[5.5px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-caos-lg text-caos-text truncate flex-1">{d.name}</span>
              <span className="tabular text-caos-xs px-1 rounded border" style={{ color: d.grade === "A" ? "var(--caos-success)" : d.grade === "B" ? "var(--caos-warning)" : "var(--caos-critical)", borderColor: "currentColor" }}>{d.grade}</span>
            </div>
            <div className="tabular text-caos-2xs text-caos-muted mt-0.5 flex gap-2 whitespace-nowrap">
              <span>{d.id}</span><span>{d.type}</span><span>{d.pages}pp</span><span>{d.date}</span>
              {d.mnpi ? <span style={{ color: "var(--caos-warning)" }}>MNPI</span> : null}
            </div>
          </div>
        ))}
      </Panel>
      <Panel title="Evidence Trace · CP-5B drivers" className="flex-[3]">
        {/* fallow-ignore-next-line complexity */}
        {DRIVERS.map((d) => {
          const hot = !!(active && d.evs.includes(active)) || !!(ev && d.evs.includes(ev));
          return (
            <div
              key={d.n}
              tabIndex={0}
              aria-label={`Evidence for driver ${d.n}: ${d.driver}`}
              onMouseEnter={() => setActive(d.evs[0])}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(d.evs[0])}
              onBlur={() => setActive(null)}
              className={"px-3 py-2 border-b border-caos-border/50 transition-caos " + (hot ? "caos-selected bg-caos-elevated relative z-[5]" : "hover:bg-caos-elevated/60")}
            >
              <div className="flex items-start gap-2">
                <span className="tabular text-caos-xs text-caos-muted mt-px">#{d.n}</span>
                <span className="text-caos-md text-caos-text leading-snug flex-1">{d.driver}</span>
                <Tag sev={d.status === "verified" ? "ok" : "warning"}>{d.status}</Tag>
              </div>
              <div className="tabular text-caos-2xs text-caos-muted mt-1 leading-relaxed pl-4">{d.lineage}</div>
              <div className="flex items-center gap-1.5 mt-1 pl-4">
                <Bar pct={d.conf * 100} color={d.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)"} h={2} />
                <span className="tabular text-caos-2xs text-caos-muted shrink-0">conf {(d.conf * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </Panel>
    </RailShell>
  );
}

export function DecisionRail({
  open,
  onToggle,
  council = [],
  isReference = true,
  issuerCode,
}: {
  open: boolean;
  onToggle: () => void;
  council?: FindingDTO[];
  isReference?: boolean;
  issuerCode?: string;
}) {
  const code = isReference ? undefined : (issuerCode || "—");
  return (
    <RailShell
      open={open}
      onToggle={onToggle}
      expandTitle="Expand decision rail"
      glyph="⊏"
      collapsed={
        <>
          <span className="text-caos-xl" style={{ color: "var(--caos-warning)" }} aria-hidden="true">⛨</span>
          <span className="tabular text-caos-2xs uppercase tracking-widest" style={{ writingMode: "vertical-rl", color: "var(--caos-warning)" }}>CP-5 conditional</span>
          <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted" style={{ writingMode: "vertical-rl" }}>Verdict · Sizing · Triggers</span>
        </>
      }
    >
      {isReference ? (
        <div className="bg-caos-panel border rounded-md px-3 py-2.5 shrink-0" style={{ borderColor: "rgba(245,165,36,0.45)" }}>
          <div className="flex items-center gap-2">
            <span className="text-caos-2xl" style={{ color: "var(--caos-warning)" }} aria-hidden="true">⛨</span>
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">CP-5 clearance</span>
            <span className="tabular text-caos-2xl uppercase tracking-wide font-semibold" style={{ color: "var(--caos-warning)" }}>CONDITIONAL</span>
            <button onClick={onToggle} title="Collapse decision rail" aria-label="Collapse decision rail" className="ml-auto text-caos-muted hover:text-caos-text transition-caos text-caos-2xl focus-ring">⊐</button>
          </div>
          <div className="text-caos-lg text-caos-text mt-1.5 leading-snug">
            QA-117 (HIGH) open — citation E-44 page mismatch. Committee pack assembly HELD; debate verdict stands ex-E-44.
          </div>
        </div>
      ) : (
        <RefTemplateStrip code={code} onCollapse={onToggle} />
      )}

      <CouncilReview council={council} />

      <Panel title="IC Verdict · CP-6A" className="shrink-0">
        <div className="px-3 py-2.5">
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Recommendation bias</div>
          {/* The committee's call — the climax of the whole platform. Hero it:
              the rating word at display tier, the qualifier as a quiet sub-line. */}
          {(() => {
            const [head, ...rest] = DEBATE.bias.split(" — ");
            const tail = rest.join(" — ");
            return (
              <>
                <div className="text-caos-display font-bold" style={{ color: "var(--caos-success-bright)" }}>{head}</div>
                {tail ? <div className="text-caos-md text-caos-text mt-1 leading-snug">— {tail}</div> : null}
              </>
            );
          })()}
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mt-3 mb-1">Single greatest uncertainty</div>
          <div className="text-caos-lg text-caos-text leading-snug">{DEBATE.uncertainty}</div>
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mt-3 mb-1">Chair final memo</div>
          <div className="text-caos-lg text-caos-muted leading-relaxed">{DEBATE.memo}</div>
        </div>
      </Panel>

      <Panel title="Sizing & Posture · CP-6E" className="shrink-0">
        <div className="px-3 py-2.5">
          <div className="text-caos-2xl text-caos-text font-medium">{SIZING.decision}</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([["Initial", SIZING.initial], ["Max", SIZING.max], ["Entry", SIZING.entry]] as const).map(([l, v]) => (
              <div key={l}>
                <div className="tabular text-caos-2xs uppercase text-caos-muted">{l}</div>
                <div className="tabular text-caos-lg text-caos-text mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <div className="text-caos-lg text-caos-muted leading-snug mt-2">{SIZING.constraint}</div>
        </div>
      </Panel>

      <Panel title="Triggers Armed → CP-MON" className="flex-1">
        {TRIGGERS.map((tr) => (
          <div key={tr.id} className="px-3 py-[6px] border-b border-caos-border/50 flex items-start gap-2">
            <Dot sev={tr.sev} />
            <div>
              <div className="text-caos-lg text-caos-text leading-snug">{tr.text}</div>
              <div className="tabular text-caos-2xs text-caos-muted mt-0.5">{tr.id} · on trip → {tr.owner}</div>
            </div>
          </div>
        ))}
        <div className="px-3 py-2">
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Add / trim discipline</div>
          {SIZING.addTriggers.map((x, i) => (
            <div key={i} className="text-caos-lg text-caos-muted leading-snug flex gap-1.5"><span style={{ color: "var(--caos-success)" }}>+</span>{x}</div>
          ))}
          {SIZING.trimTriggers.map((x, i) => (
            <div key={i} className="text-caos-lg text-caos-muted leading-snug flex gap-1.5"><span style={{ color: "var(--caos-critical-bright)" }}>−</span>{x}</div>
          ))}
        </div>
      </Panel>
    </RailShell>
  );
}
