"use client";

// Bespoke deep-dive tabs: CP-6A adversarial debate, CP-3B recovery waterfall,
// CP-4/4C covenants — plus the generic module output view
// (port of design bundle concept-c-app.jsx + concept-c-views.jsx ModuleView).

import { useState } from "react";
import Link from "next/link";
import { CAPACITY, CAPSTACK, COVENANTS, DEBATE, RECOVERY } from "@/lib/reports/deal";
import { MODULE_OUTPUTS, type ModuleOutput } from "@/lib/deepdive/module-outputs";
import { MODULES, SIM_PLAN } from "@/lib/pipeline/data";
import { SEV_COLOR, type Sim } from "@/lib/pipeline/sim";
import { EvChip } from "@/components/reports/EvidenceModal";
import { EVIDENCE } from "@/lib/reports/evidence";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { StatCard } from "@/components/shared/StatCard";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { fmtNum, fmtPct } from "@/lib/format";
import { G2Chart, type G2Spec } from "@/components/charts/G2Chart";
import { CHART_HEX, TRANCHE_HEX } from "@/lib/chart-colors";
import { OutSections } from "./OutSections";
import { OutputRegister } from "./OutputRegister";
import { ModuleCharts } from "./ModuleCharts";

const PERSONA: Record<string, { color: string; glyph: string; label: string }> = {
  BULL: { color: "var(--caos-success)", glyph: "▲", label: "Bull Analyst" },
  BEAR: { color: "var(--caos-critical)", glyph: "▼", label: "Bear Analyst" },
  CHAIR: { color: "var(--caos-accent)", glyph: "⚖", label: "IC Chair" },
};
const TRANCHE: Record<string, string> = {
  "1l": "var(--tranche-1l)", "2l": "var(--tranche-2l)", unsec: "var(--tranche-unsec)",
  sub: "var(--tranche-sub)", eq: "var(--tranche-eq)",
};

type OpenEv = (id: string) => void;

/* ---------- Debate tab ---------- */
export function DebateTab({ onOpenEvidence }: { onOpenEvidence: OpenEv }) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <OutputRegister id="CP-6A" defaultOpen={false} onOpenEvidence={onOpenEvidence} />
      <div className="rounded border border-caos-border bg-caos-bg px-3 py-2.5">
        <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1">CP-6A-02 · Pre-debate thesis map</div>
        <div className="text-[11.5px] text-caos-text leading-relaxed">{DEBATE.thesis}</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {DEBATE.rounds.map((r, i) => {
          const p = PERSONA[r.who];
          return (
            <div key={i} className="rounded border border-caos-border bg-caos-bg flex flex-col">
              <div className="px-3 py-2 border-b border-caos-border flex items-center gap-2">
                <span className="text-caos-2xl" style={{ color: p.color }}>{p.glyph}</span>
                <span className="text-caos-2xl font-semibold" style={{ color: p.color }}>{p.label}</span>
                <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted ml-auto">{r.phase}</span>
              </div>
              <div className="p-3 flex flex-col gap-2.5">
                {r.points.map((pt, j) => (
                  <div key={j} className="flex gap-2">
                    <span className="tabular text-caos-2xs mt-px shrink-0" style={{ color: p.color }}>{String(j + 1).padStart(2, "0")}</span>
                    <div>
                      <span className="text-caos-lg text-caos-text leading-snug">{pt.text}</span>
                      {pt.ev.length ? (
                        <span className="inline-flex gap-1 ml-1.5 align-middle">
                          {pt.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded border border-caos-border bg-caos-bg">
        <div className="px-3 py-2 border-b border-caos-border flex items-center gap-2">
          <span className="text-caos-2xl text-caos-accent">⚖</span>
          <span className="text-caos-xl font-semibold text-caos-text">IC Chair — Evidence Weighting & Resolution Matrix</span>
          <span className="tabular text-caos-xs text-caos-muted ml-auto">CP-6A-06 / 07</span>
        </div>
        <div className="grid grid-cols-[220px_220px_1fr_130px] gap-x-3 px-3 h-7 items-center border-b border-caos-border">
          {["Contested claim", "Weighting (bull ◂ ▸ bear)", "Chair verdict", "Evidence"].map((h) => (
            <span key={h} className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">{h}</span>
          ))}
        </div>
        {DEBATE.weighting.map((w, i) => (
          <div key={i} className="grid grid-cols-[220px_220px_1fr_130px] gap-x-3 px-3 py-[7px] items-center border-b border-caos-border/50 hover:bg-caos-elevated/50 transition-caos">
            <span className="text-caos-lg text-caos-text leading-snug">{w.claim}</span>
            <span className="flex items-center gap-1.5" aria-label={`bull ${(w.bull * 100).toFixed(0)} versus bear ${(w.bear * 100).toFixed(0)}`}>
              <span className="tabular text-caos-xs flex items-center gap-0.5" style={{ color: "var(--caos-success)" }}><span aria-hidden="true">▲</span>{(w.bull * 100).toFixed(0)}</span>
              <span className="flex-1 h-[5px] rounded-full overflow-hidden flex" style={{ background: "var(--caos-border)" }}>
                <span style={{ width: w.bull * 100 + "%", background: "var(--caos-success)" }}></span>
                <span style={{ width: w.bear * 100 + "%", background: "var(--caos-critical)" }}></span>
              </span>
              <span className="tabular text-caos-xs flex items-center gap-0.5" style={{ color: "var(--caos-critical)" }}>{(w.bear * 100).toFixed(0)}<span aria-hidden="true">▼</span></span>
            </span>
            <span className="text-caos-md leading-snug" style={{ color: w.verdict.startsWith("BULL") ? "var(--caos-success)" : w.verdict.startsWith("BEAR") ? "var(--caos-critical)" : "var(--caos-muted)" }}>{w.verdict}</span>
            <span className="flex flex-wrap gap-1">
              {w.ev.split(" · ").map((tok) => {
                const eid = tok.split(" ")[0];
                return EVIDENCE[eid]
                  ? <EvChip key={eid} id={eid} onOpen={onOpenEvidence} />
                  : <span key={tok} className="tabular text-caos-xs text-caos-accent">{tok}</span>;
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Recovery tab ---------- */
function recoveries(ev: number): Record<string, number> {
  const cl1 = 1970, cl2 = 900, sub = 400;
  return {
    "1l": Math.min(1, ev / cl1),
    "2l": Math.min(1, Math.max(0, ev - cl1) / cl2),
    sub: Math.min(1, Math.max(0, ev - cl1 - cl2) / sub),
  };
}

/* G2 v5 specs (antv-g2-chart skill) — static data, module-level so refs stay stable */
const TR_LABELS: Record<string, string> = { "1l": "1L (RCF+TLB)", "2l": "2L TL ◆", sub: "Sub Notes" };
const RECOVERY_CHART_SPEC: G2Spec = {
  type: "interval",
  data: RECOVERY.flatMap((s) => {
    const r = recoveries(s.ev);
    return ["1l", "2l", "sub"].map((k) => ({ scenario: s.scen, tranche: TR_LABELS[k], rec: r[k] }));
  }),
  encode: { x: "scenario", y: "rec", color: "tranche" },
  transform: [{ type: "dodgeX" }],
  coordinate: { transform: [{ type: "transpose" }] },
  scale: {
    y: { domain: [0, 1] },
    color: { domain: Object.values(TR_LABELS), range: [TRANCHE_HEX["1l"], TRANCHE_HEX["2l"], TRANCHE_HEX.sub] },
  },
  axis: {
    x: { title: false },
    y: { title: false, labelFormatter: (d: number) => (d * 100).toFixed(0) + "%" },
  },
  legend: { color: { position: "top" } },
  labels: [{
    text: (d: { rec: number }) => (d.rec * 100).toFixed(0) + "%",
    position: "inside",
    fontSize: 9,
    transform: [{ type: "contrastReverse" }, { type: "overflowHide" }],
  }],
};
const CAPSTACK_CHART_SPEC: G2Spec = {
  type: "interval",
  data: CAPSTACK.map((c) => ({ slot: "stack", cls: c.cls, claim: c.claim })),
  encode: { x: "slot", y: "claim", color: "cls" },
  transform: [{ type: "stackY" }],
  coordinate: { transform: [{ type: "transpose" }] },
  axis: false,
  legend: false,
  scale: { color: {
    domain: CAPSTACK.map((c) => c.cls),
    range: [CHART_HEX.tealDeep, TRANCHE_HEX["1l"], TRANCHE_HEX["2l"], TRANCHE_HEX.sub, TRANCHE_HEX.eq],
  } },
  labels: [{
    text: (d: { cls: string; claim: number }) => "$" + d.claim.toLocaleString(),
    position: "inside",
    fontSize: 8.5,
    transform: [{ type: "contrastReverse" }, { type: "overflowHide" }],
  }],
};

export function RecoveryTab({ onOpenEvidence }: { onOpenEvidence: OpenEv }) {
  const total = CAPSTACK.reduce((s, c) => s + (c.key !== "eq" ? c.claim : 0), 0);
  const ebitdas = [421, 360, 295], mults = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5];
  return (
    <div className="p-3 flex flex-col gap-3">
      <OutputRegister id="CP-3B" defaultOpen={false} onOpenEvidence={onOpenEvidence} />
      <div className="grid grid-cols-[440px_1fr] gap-3">
        <div className="rounded border border-caos-border bg-caos-bg">
          <SectionHeader title="CP-3B-02 · Capital structure ($M)" />
          {CAPSTACK.map((c) => (
            <div key={c.cls} className="grid grid-cols-[14px_1fr_70px_60px_56px] gap-x-2 items-center px-3 py-[6px] border-b border-caos-border/50">
              <span className="w-2 h-2 rounded-sm" style={{ background: TRANCHE[c.key] }}></span>
              <span className="text-caos-lg text-caos-text">{c.cls}</span>
              <span className="tabular text-caos-md text-caos-muted">{c.rate}</span>
              <span className="tabular text-caos-lg text-right text-caos-text">{fmtNum(c.claim)}</span>
              <span className="tabular text-caos-sm text-right text-caos-muted">{c.key === "eq" ? "—" : fmtPct(c.claim / total, 1)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[14px_1fr_70px_60px_56px] gap-x-2 items-center px-3 py-[6px]">
            <span></span><span className="text-caos-md font-semibold text-caos-text">Total debt</span><span></span>
            <span className="tabular text-caos-lg text-right text-caos-text font-semibold">{fmtNum(total)}</span>
            <span className="tabular text-caos-sm text-right text-caos-muted">5.7x</span>
          </div>
          <div className="px-2 pb-1 border-t border-caos-border/50">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted px-1 pt-1.5">Seniority stack · claims incl. equity ($M)</div>
            <G2Chart spec={CAPSTACK_CHART_SPEC} height={52} />
          </div>
        </div>

        <div className="rounded border border-caos-border bg-caos-bg">
          <SectionHeader title="CP-3B-06 · Recovery waterfall by scenario" right="claims: 1L $1,970 · 2L $900 · Sub $400" />
          {RECOVERY.map((s) => (
            <div key={s.scen} className="flex items-center gap-3 px-3 py-[5px] border-b border-caos-border/50">
              <span className="text-caos-lg font-medium text-caos-text w-24">{s.scen}</span>
              <span className="tabular text-caos-sm text-caos-muted">{s.mult} × ${s.ebitda}M = <span className="text-caos-text">${(s.ev / 1000).toFixed(2)}B EV</span></span>
              <span className="text-caos-xs text-caos-muted ml-auto">{s.note}</span>
            </div>
          ))}
          <div className="px-2 pt-1">
            <G2Chart spec={RECOVERY_CHART_SPEC} height={192} />
          </div>
          <div className="px-3 py-1.5 text-caos-sm text-caos-muted">
            Market-implied 2L recovery at px 96.4 ≈ <span className="tabular text-caos-text">38%</span> under base-distress probability weights — wide of model in severe only.
          </div>
        </div>
      </div>

      <div className="rounded border border-caos-border bg-caos-bg">
        <SectionHeader title="2L TL recovery sensitivity — exit multiple × stressed EBITDA" right="cells: % of par" />
        <div className="p-3">
          <div className="grid" style={{ gridTemplateColumns: `120px repeat(${mults.length}, 1fr)`, gap: 4 }}>
            <span></span>
            {mults.map((m) => <span key={m} className="tabular text-caos-sm text-caos-muted text-center">{m.toFixed(1)}x</span>)}
            {ebitdas.map((e) => (
              <span key={"row" + e} className="contents">
                <span className="tabular text-caos-sm text-caos-muted self-center">${e}M {e === 421 ? "(LTM adj.)" : e === 360 ? "(base stress)" : "(severe)"}</span>
                {mults.map((m) => {
                  const r = recoveries(e * m)["2l"];
                  const c = r >= 0.9 ? "rgba(34,197,94," : r >= 0.5 ? "rgba(245,165,36," : "rgba(239,68,68,";
                  return (
                    <span key={m} className="h-8 rounded-sm flex items-center justify-center transition-caos hover:opacity-80 cursor-default" style={{ background: c + (0.12 + r * 0.3) + ")" }}>
                      <span className="tabular text-caos-lg" style={{ color: r >= 0.9 ? "var(--caos-success-bright)" : r >= 0.5 ? "var(--caos-warning-bright)" : "var(--caos-critical-bright)" }}>{(r * 100).toFixed(0)}</span>
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Covenants tab ---------- */
export function CovenantsTab({ onOpenEvidence }: { onOpenEvidence: OpenEv }) {
  const [open, setOpen] = useState<string | null>(COVENANTS[1].ref);
  const seg = (n: number) => (
    <span className="flex gap-px" role="img" aria-label={`aggressiveness ${n} of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="w-1.5 h-2.5 rounded-[1px]" style={{ background: i < n ? (n >= 8 ? "var(--caos-critical)" : n >= 6 ? "var(--caos-warning)" : "var(--caos-success)") : "var(--caos-border)" }}></span>
      ))}
    </span>
  );
  return (
    <div className="p-3 flex flex-col gap-3">
      <OutputRegister id="CP-4" defaultOpen={false} onOpenEvidence={onOpenEvidence} />
      <OutputRegister id="CP-4C" defaultOpen={false} onOpenEvidence={onOpenEvidence} />
      <StatCard
        size="hero"
        sev="critical"
        value="7.2 / 10"
        label="Covenant aggressiveness — the binding read on this credit"
        sub="vs 2026 single-B market norm 6.1"
      />
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Day-one incremental capacity", v: "$" + CAPACITY.incDebt + "M", sub: "ahead of the 2L TL · MFN sunsets 12mo", sev: "critical" },
          { l: "RP capacity usable today", v: "$" + CAPACITY.rpToday + "M", sub: "builder + starter baskets", sev: "warning" },
          { l: "EBITDA add-backs", v: CAPACITY.addbackPct + "%", sub: "$" + CAPACITY.addback + "M of adj. EBITDA", sev: "warning" },
        ].map((c) => (
          <StatCard key={c.l} value={c.v} label={c.l} sub={c.sub} sev={c.sev} />
        ))}
      </div>
      <div className="rounded border border-caos-border bg-caos-bg px-3 py-2 flex items-center gap-2">
        <span className="text-caos-xl" style={{ color: "var(--caos-warning)" }} aria-hidden="true">⌖</span>
        <span className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">CP-4C-10 nearest pressure point</span>
        <span className="text-caos-lg text-caos-text">{CAPACITY.nearest}</span>
      </div>

      <div className="rounded border border-caos-border bg-caos-bg">
        <div className="grid grid-cols-[230px_1fr_120px_150px_60px] gap-x-3 px-3 h-7 items-center border-b border-caos-border">
          {["Provision · controlling doc", "Feature", "Aggressiveness", "Headroom / capacity", ""].map((h, i) => (
            <span key={i} className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">{h}</span>
          ))}
        </div>
        {COVENANTS.map((c) => {
          const isOpen = open === c.ref;
          return (
            <div key={c.ref} className="border-b border-caos-border/50">
              <button
                onClick={() => setOpen(open === c.ref ? null : c.ref)}
                aria-expanded={isOpen}
                className="w-full text-left grid grid-cols-[230px_1fr_120px_150px_60px] gap-x-3 px-3 py-[7px] items-center hover:bg-caos-elevated/50 transition-caos focus-ring"
              >
                <span className="tabular text-caos-sm text-caos-accent">{c.ref}</span>
                <span className="text-caos-lg text-caos-text flex items-center gap-2"><Dot sev={c.flag} />{c.name}</span>
                <span className="flex items-center gap-1.5">{seg(c.agg)}<span className="tabular text-caos-xs text-caos-muted">{c.agg}</span></span>
                <span className="tabular text-caos-md" style={{ color: c.flag === "ok" ? "var(--caos-muted)" : SEV_COLOR[c.flag] }}>{c.headroom}</span>
                <span className="justify-self-end text-caos-muted text-caos-xs">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen ? (
                <div className="px-3 pb-3 grid grid-cols-2 gap-3 caos-enter">
                  <div>
                    <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Controlling clause (verbatim)</div>
                    <div className="clause-highlight tabular px-2.5 py-2 text-caos-text/90 leading-relaxed text-caos-xl">{c.clause}</div>
                  </div>
                  <div>
                    <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">CP-4 interpretation · credit translation</div>
                    <div className="text-caos-lg text-caos-text leading-relaxed">{c.read}</div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- generic module output view ---------- */
export function ModuleView({
  id,
  sim,
  onOpenEvidence,
  liveOut,
}: {
  id: string;
  sim: Sim;
  onOpenEvidence: OpenEv;
  // Live, adapted module output (from a real run). Falls back to the seeded
  // demo register when absent, so the offline sim is unaffected.
  liveOut?: ModuleOutput;
}) {
  const meta = MODULES.find((m) => m.id === id);
  const plan = SIM_PLAN.find((m) => m.id === id);
  const out = liveOut ?? MODULE_OUTPUTS[id];
  const st = sim.mods[id]?.state || "idle";
  if (!out || !meta) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-caos-muted">
        <div className="tabular text-caos-xl text-caos-text">{id} · no analytical output register</div>
        <div className="text-caos-md leading-relaxed max-w-[400px]">
          {meta
            ? meta.name + " is an infrastructure module — its product is the committee pack itself, not an output register."
            : "This module id is not part of the CP-X route graph."}
        </div>
        {meta ? (
          <Link
            href="/reports"
            className="tabular text-caos-sm px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
          >
            OPEN REPORT STUDIO →
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="rounded border border-caos-border bg-caos-bg px-3 py-2.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Dot sev={st} />
            <span className="tabular text-caos-2xl text-caos-text whitespace-nowrap">{id}</span>
            <span className="text-[11.5px] font-semibold text-caos-text">{meta.name}</span>
            <Tag sev={st}>{st}</Tag>
          </div>
          <div className="text-caos-md text-caos-muted mt-1">{meta.desc}</div>
          {plan?.event ? <div className="tabular text-caos-sm text-caos-muted mt-1.5 leading-snug">▸ {plan.event}</div> : null}
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${out.kpis.length}, 1fr)` }}>
        {out.kpis.map((k) => (
          <StatCard key={k.l} value={k.v} label={k.l} sev={k.sev} />
        ))}
      </div>

      <OutputRegister id={id} defaultOpen={false} onOpenEvidence={onOpenEvidence} />

      <OutSections sections={out.sections} onOpenEvidence={onOpenEvidence} />

      <ModuleCharts id={id} />
    </div>
  );
}
