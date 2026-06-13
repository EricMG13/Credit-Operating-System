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

export { Panel };

export function SourceRail({
  ev,
  open,
  onToggle,
}: {
  ev: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const { active, setActive } = useEvidenceSync();
  return (
    <RailShell
      open={open}
      onToggle={onToggle}
      expandTitle="Expand source rail"
      glyph="⊐"
      collapsed={
        <>
          <span className="tabular text-[10px] text-caos-accent" style={{ writingMode: "vertical-rl" }}>{DEAL.code}</span>
          <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted" style={{ writingMode: "vertical-rl" }}>Source register · Evidence trace</span>
        </>
      }
    >
      <div className="bg-caos-panel border border-caos-border rounded-md px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="tabular text-[12px] text-caos-accent">{DEAL.code}</span>
          <span className="text-[12px] font-semibold text-caos-text">{DEAL.name}</span>
          <button onClick={onToggle} title="Collapse source rail" aria-label="Collapse source rail" className="ml-auto text-caos-muted hover:text-caos-text transition-caos text-[12px] focus-ring">⊏</button>
        </div>
        <div className="text-[9.5px] text-caos-muted mt-1 leading-relaxed">{DEAL.sector}<br />{DEAL.sponsor}</div>
        <div className="flex gap-3 mt-1.5 tabular text-[9.5px]">
          <span className="text-caos-muted">{DEAL.rating}</span>
          <span className="text-caos-text">LTM adj. EBITDA ${DEAL.ebitda}M</span>
          <span className="text-caos-text">{DEAL.netLev}x</span>
        </div>
      </div>
      <Panel title="Source Register · CP-0" className="flex-[2]">
        {DOCS.map((d) => (
          <div key={d.id} className="px-3 py-[5.5px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-caos-text truncate flex-1">{d.name}</span>
              <span className="tabular text-[9px] px-1 rounded border" style={{ color: d.grade === "A" ? "var(--caos-success)" : d.grade === "B" ? "var(--caos-warning)" : "var(--caos-critical)", borderColor: "currentColor" }}>{d.grade}</span>
            </div>
            <div className="tabular text-[8.5px] text-caos-muted mt-0.5 flex gap-2 whitespace-nowrap">
              <span>{d.id}</span><span>{d.type}</span><span>{d.pages}pp</span><span>{d.date}</span>
              {d.mnpi ? <span style={{ color: "var(--caos-warning)" }}>MNPI</span> : null}
            </div>
          </div>
        ))}
      </Panel>
      <Panel title="Evidence Trace · CP-5B drivers" className="flex-[3]">
        {DRIVERS.map((d) => {
          const hot = !!(active && d.evs.includes(active)) || !!(ev && d.evs.includes(ev));
          return (
            <div
              key={d.n}
              onMouseEnter={() => setActive(d.evs[0])}
              onMouseLeave={() => setActive(null)}
              className={"px-3 py-2 border-b border-caos-border/50 transition-caos " + (hot ? "caos-selected bg-caos-elevated relative z-[5]" : "hover:bg-caos-elevated/60")}
            >
              <div className="flex items-start gap-2">
                <span className="tabular text-[9px] text-caos-muted mt-px">#{d.n}</span>
                <span className="text-[10px] text-caos-text leading-snug flex-1">{d.driver}</span>
                <Tag sev={d.status === "verified" ? "ok" : "warning"}>{d.status}</Tag>
              </div>
              <div className="tabular text-[8.5px] text-caos-muted mt-1 leading-relaxed pl-4">{d.lineage}</div>
              <div className="flex items-center gap-1.5 mt-1 pl-4">
                <Bar pct={d.conf * 100} color={d.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)"} h={2} />
                <span className="tabular text-[8.5px] text-caos-muted shrink-0">conf {(d.conf * 100).toFixed(0)}%</span>
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
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <RailShell
      open={open}
      onToggle={onToggle}
      expandTitle="Expand decision rail"
      glyph="⊏"
      collapsed={
        <>
          <span className="text-[11px]" style={{ color: "var(--caos-warning)" }} aria-hidden="true">⛨</span>
          <span className="tabular text-[8.5px] uppercase tracking-widest" style={{ writingMode: "vertical-rl", color: "var(--caos-warning)" }}>CP-5 conditional</span>
          <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted" style={{ writingMode: "vertical-rl" }}>Verdict · Sizing · Triggers</span>
        </>
      }
    >
      <div className="bg-caos-panel border rounded-md px-3 py-2.5 shrink-0" style={{ borderColor: "rgba(245,165,36,0.45)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[12px]" style={{ color: "var(--caos-warning)" }} aria-hidden="true">⛨</span>
          <span className="tabular text-caos-micro uppercase tracking-wider text-caos-muted">CP-5 clearance</span>
          <span className="tabular text-caos-row uppercase tracking-wide font-semibold" style={{ color: "var(--caos-warning)" }}>CONDITIONAL</span>
          <button onClick={onToggle} title="Collapse decision rail" aria-label="Collapse decision rail" className="ml-auto text-caos-muted hover:text-caos-text transition-caos text-[12px] focus-ring">⊐</button>
        </div>
        <div className="text-caos-body text-caos-text mt-1.5 leading-snug">
          QA-117 (HIGH) open — citation E-44 page mismatch. Committee pack assembly HELD; debate verdict stands ex-E-44.
        </div>
      </div>

      <Panel title="IC Verdict · CP-6A" className="shrink-0">
        <div className="px-3 py-2.5">
          <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted mb-1">Recommendation bias</div>
          <div className="text-caos-metric font-semibold leading-tight" style={{ color: "var(--caos-success)" }}>{DEBATE.bias}</div>
          <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted mt-3 mb-1">Single greatest uncertainty</div>
          <div className="text-caos-body text-caos-text leading-snug">{DEBATE.uncertainty}</div>
          <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted mt-3 mb-1">Chair final memo</div>
          <div className="text-caos-body text-caos-muted leading-relaxed">{DEBATE.memo}</div>
        </div>
      </Panel>

      <Panel title="Sizing & Posture · CP-6E" className="shrink-0">
        <div className="px-3 py-2.5">
          <div className="text-caos-row text-caos-text font-medium">{SIZING.decision}</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([["Initial", SIZING.initial], ["Max", SIZING.max], ["Entry", SIZING.entry]] as const).map(([l, v]) => (
              <div key={l}>
                <div className="tabular text-caos-micro uppercase text-caos-muted">{l}</div>
                <div className="tabular text-caos-body text-caos-text mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <div className="text-caos-body text-caos-muted leading-snug mt-2">{SIZING.constraint}</div>
        </div>
      </Panel>

      <Panel title="Triggers Armed → CP-MON" className="flex-1">
        {TRIGGERS.map((tr) => (
          <div key={tr.id} className="px-3 py-[6px] border-b border-caos-border/50 flex items-start gap-2">
            <Dot sev={tr.sev} />
            <div>
              <div className="text-caos-body text-caos-text leading-snug">{tr.text}</div>
              <div className="tabular text-caos-micro text-caos-muted mt-0.5">{tr.id} · on trip → {tr.owner}</div>
            </div>
          </div>
        ))}
        <div className="px-3 py-2">
          <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted mb-1">Add / trim discipline</div>
          {SIZING.addTriggers.map((x, i) => (
            <div key={i} className="text-caos-body text-caos-muted leading-snug flex gap-1.5"><span style={{ color: "var(--caos-success)" }}>+</span>{x}</div>
          ))}
          {SIZING.trimTriggers.map((x, i) => (
            <div key={i} className="text-caos-body text-caos-muted leading-snug flex gap-1.5"><span style={{ color: "var(--caos-critical)" }}>−</span>{x}</div>
          ))}
        </div>
      </Panel>
    </RailShell>
  );
}
