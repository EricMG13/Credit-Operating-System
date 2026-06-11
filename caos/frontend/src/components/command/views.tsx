"use client";

// Command Center views: portfolio posture table, CP-MON email intelligence,
// live alert feed, CP-SR sector board, coverage matrix, QA queue, source gaps
// and the issuer detail strip (port of design bundle concept-a.jsx).

import { useState } from "react";
import Link from "next/link";
import {
  ALERTS, COVERAGE, EMAIL_TILES, EMAILS, GAPS, PORTFOLIO, QA_QUEUE, SECTORS,
} from "@/lib/command/data";
import { SEV_COLOR, simClock } from "@/lib/pipeline/sim";
import { Bar, Dot, Tag } from "@/components/pipeline/atoms";

export const POSTURE_COLOR: Record<string, string> = {
  OVERWEIGHT: "var(--caos-success)", HOLD: "var(--caos-muted)",
  UNDERWEIGHT: "var(--caos-warning)", REDUCE: "var(--caos-critical)",
};
const STANCE_COLOR: Record<string, string> = {
  CONSTRUCTIVE: "var(--caos-success)", NEUTRAL: "var(--caos-muted)",
  CAUTIOUS: "var(--caos-warning)", NEGATIVE: "var(--caos-critical)",
};

/* ---------- sparkline ---------- */
export function Spark({ data, color = "var(--caos-accent)", w = 72, h = 18 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" opacity={0.8}></polyline>
    </svg>
  );
}

/* ---------- CIO/PM view: portfolio table ---------- */
const COLS = "grid grid-cols-[150px_84px_70px_110px_50px_50px_56px_44px_80px_42px_42px_46px_92px_56px_70px_36px] items-center gap-x-2";

export function PortfolioTable({
  selected, onSelect, tick,
}: {
  selected: string | null;
  onSelect: (code: string | null) => void;
  tick: number;
}) {
  const th = "tabular text-[9px] uppercase tracking-wider text-caos-muted";
  return (
    <div className="text-[11px]" style={{ minWidth: 1180 }}>
      <div className={COLS + " px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-10"}>
        {["Issuer", "Sector", "Rating", "Instrument", "Px", "YTW", "STW", "Δ d/d", "30-Day", "NetLev", "IntCov", "M2E", "Posture", "Conv.", "QA", "⚑"].map((h, i) => (
          <span key={i} className={th + ([4, 5, 6, 7, 9, 10, 11, 13].includes(i) ? " text-right" : "")}>{h}</span>
        ))}
      </div>
      {PORTFOLIO.map((p) => {
        const sel = selected === p.code;
        const sparkColor = p.dd > 5 ? "var(--caos-critical)" : p.dd < -2 ? "var(--caos-success)" : "var(--caos-muted)";
        return (
          <div
            key={p.code}
            onClick={() => onSelect(sel ? null : p.code)}
            className={COLS + " px-3 py-[5px] border-b border-caos-border/50 cursor-pointer transition-caos hover:bg-caos-elevated/60 " + (sel ? "bg-caos-elevated caos-selected relative z-[5]" : "")}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              {p.watch ? <span className="w-[10px] text-[9px]" style={{ color: "var(--caos-critical)" }}>▲</span> : <span className="w-[10px]"></span>}
              <span className="tabular text-caos-accent">{p.code}</span>
              <span className="text-caos-text truncate text-[10.5px]">{p.name}</span>
            </span>
            <span className="text-caos-muted text-[10px] truncate">{p.sector}</span>
            <span className="tabular text-[10px] text-caos-muted">{p.rating}</span>
            <span className="tabular text-[10px] text-caos-text truncate">{p.inst}</span>
            <span className="tabular text-right">{p.px.toFixed(1)}</span>
            <span className="tabular text-right">{p.ytw.toFixed(2)}</span>
            <span className="tabular text-right text-caos-text">{p.stw + (p.watch ? Math.floor(tick / 9) % 3 : 0)}</span>
            <span className="tabular text-right" style={{ color: p.dd > 0 ? "var(--caos-critical)" : "var(--caos-success)" }}>{p.dd > 0 ? "+" + p.dd : p.dd}</span>
            <Spark data={p.spark} color={sparkColor} w={76} h={16} />
            <span className="tabular text-right">{p.lev.toFixed(1)}x</span>
            <span className="tabular text-right">{p.cov.toFixed(1)}x</span>
            <span className="tabular text-right" style={{ color: p.m2e < 12 ? "var(--caos-warning)" : undefined }}>{p.m2e.toFixed(1)}</span>
            <span className="tabular text-[9px] tracking-wide" style={{ color: POSTURE_COLOR[p.posture] }}>{p.posture}</span>
            <span className="flex gap-px">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="w-1 h-2.5 rounded-sm" style={{ background: i <= p.conv ? "var(--caos-accent)" : "var(--caos-border)" }}></span>
              ))}
            </span>
            <span><Tag sev={p.qa}>{p.qa}</Tag></span>
            <span className="tabular text-right" style={{ color: p.alerts ? "var(--caos-warning)" : "var(--caos-idle)" }}>{p.alerts || "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- CP-MON email intelligence ---------- */
export function EmailIntel({ tick, live }: { tick: number; live: boolean }) {
  const [filter, setFilter] = useState<string | null>(null);
  const grow = live ? Math.floor(tick / 8) : 0;
  const tiles = [
    { k: "critical", label: "Critical", n: EMAIL_TILES.critical, sub: "≥ 90 materiality" },
    { k: "high", label: "High", n: EMAIL_TILES.high, sub: "70–89" },
    { k: "medium", label: "Medium", n: EMAIL_TILES.medium + Math.floor(grow / 2), sub: "40–69" },
    { k: "low", label: "Low", n: EMAIL_TILES.low + grow, sub: "< 40 · auto-filed" },
  ];
  const list = EMAILS.filter((e) => !filter || e.sev === filter);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-6 gap-1.5 p-2 shrink-0">
        {tiles.map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(filter === t.k ? null : t.k)}
            className={"text-left rounded border px-2 py-1.5 transition-caos " + (filter === t.k ? "caos-selected bg-caos-elevated" : "bg-caos-bg hover:bg-caos-elevated/70")}
            style={{ borderColor: filter === t.k ? "var(--caos-accent)" : SEV_COLOR[t.k] + "44" }}
          >
            <div className="tabular text-[17px] leading-none" style={{ color: SEV_COLOR[t.k] }}>{t.n}</div>
            <div className="text-[9px] uppercase tracking-wider text-caos-muted mt-1">{t.label}</div>
            <div className="tabular text-[8.5px] text-caos-muted/70">{t.sub}</div>
          </button>
        ))}
        <div className="rounded border border-caos-border bg-caos-bg px-2 py-1.5">
          <div className="tabular text-[17px] leading-none text-caos-muted">{EMAIL_TILES.dedup}</div>
          <div className="text-[9px] uppercase tracking-wider text-caos-muted mt-1">Deduped</div>
          <div className="tabular text-[8.5px] text-caos-muted/70">CP-MON-F</div>
        </div>
        <div className="rounded border border-caos-border bg-caos-bg px-2 py-1.5">
          <div className="tabular text-[17px] leading-none text-caos-text">{EMAIL_TILES.unresolved}</div>
          <div className="text-[9px] uppercase tracking-wider text-caos-muted mt-1">Unresolved</div>
          <div className="tabular text-[8.5px] text-caos-muted/70">issuer match</div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto border-t border-caos-border">
        {list.map((e, i) => (
          <div key={i} className="grid grid-cols-[40px_46px_1fr_120px_40px_130px] items-center gap-x-2 px-3 py-[5px] border-b border-caos-border/50 text-[10.5px] hover:bg-caos-elevated/60 transition-caos cursor-pointer">
            <span className="tabular text-[10px] text-caos-muted">{e.t}</span>
            <span className="tabular text-caos-accent">{e.issuer}</span>
            <span className="min-w-0">
              <span className="text-caos-text truncate block">{e.subj}{e.dedup ? <span className="text-caos-muted/70 text-[9px]"> · dup</span> : null}</span>
              <span className="text-caos-muted/80 text-[9px] truncate block">{e.src}</span>
            </span>
            <span className="text-[9.5px] text-caos-muted truncate">{e.signal}</span>
            <span className="tabular text-right" style={{ color: SEV_COLOR[e.sev] }}>{e.mat}</span>
            <span className="tabular text-[9px] text-caos-muted truncate text-right">→ {e.route}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- CP-MON live alert feed ---------- */
export function AlertFeed({ tick, live }: { tick: number; live: boolean }) {
  const visible = live ? Math.min(ALERTS.length, Math.floor(tick / 5) + 2) : ALERTS.length;
  const items = ALERTS.slice(0, visible);
  return (
    <div>
      {items.map((a, i) => (
        <div key={a.code} className={"flex items-start gap-2 px-3 py-[6px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos " + (i === 0 && live ? "caos-enter" : "")}>
          <Dot sev={a.sev} pulse={i === 0 && live} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="tabular text-[10px] text-caos-accent">{a.issuer}</span>
              <span className="tabular text-[9px] text-caos-muted">{a.code}</span>
              <span className="tabular text-[9px] text-caos-muted ml-auto">{simClock(Math.max(0, tick - i * 5))}</span>
            </div>
            <div className="text-[10.5px] text-caos-text leading-snug mt-0.5">{a.text}</div>
            <div className="mt-1"><Tag sev="info">route → {a.route}</Tag></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- CP-SR sector board ---------- */
export function SectorBoard() {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-2">
      {SECTORS.map((s) => (
        <div key={s.sector} className="rounded border border-caos-border bg-caos-bg px-2.5 py-2 hover:border-caos-accent/50 transition-caos cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-caos-text">{s.sector}</span>
            {s.ew > 0 ? <span className="tabular text-[9px]" style={{ color: s.ew >= 3 ? "var(--caos-critical)" : "var(--caos-warning)" }}>⚠ {s.ew}</span> : null}
          </div>
          <div className="tabular text-[9px] tracking-wide mt-1" style={{ color: STANCE_COLOR[s.stance] }}>{s.stance}</div>
          <div className="text-[9.5px] text-caos-muted mt-1 leading-snug">{s.trend}</div>
          <div className="tabular text-[8.5px] text-caos-muted/70 mt-1.5 flex justify-between">
            <span>rev. {s.reviewed}</span>
            {s.due ? <span style={{ color: "var(--caos-warning)" }}>REFRESH DUE</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Research view ---------- */
const CELL_COLOR: Record<string, string> = {
  fresh: "rgba(34,197,94,0.35)", aging: "rgba(245,165,36,0.35)", stale: "rgba(239,68,68,0.4)",
  running: "var(--caos-accent)", blocked: "var(--caos-critical)",
};

export function CoverageMatrix() {
  const layers = ["L1", "L2", "L3", "L4", "L5", "L6"];
  return (
    <div className="p-2">
      <div className="grid grid-cols-[110px_repeat(6,1fr)_70px] gap-1 items-center mb-1 px-1">
        <span className="tabular text-[9px] uppercase text-caos-muted">Issuer</span>
        {layers.map((l) => <span key={l} className="tabular text-[9px] uppercase text-caos-muted text-center">{l}</span>)}
        <span className="tabular text-[9px] uppercase text-caos-muted text-right">Refresh</span>
      </div>
      {COVERAGE.map((c) => (
        <div key={c.code} className="grid grid-cols-[110px_repeat(6,1fr)_70px] gap-1 items-center mb-1 px-1">
          <span className="tabular text-[10.5px] text-caos-accent">{c.code}</span>
          {layers.map((l) => {
            const st = c.cells[l];
            return (
              <div key={l} title={`${c.code} ${l} — ${st}`} className={"h-5 rounded-sm flex items-center justify-center cursor-pointer transition-caos hover:opacity-80 " + (st === "running" ? "caos-running" : "")} style={{ background: CELL_COLOR[st] }}>
                <span className="tabular text-[8px] uppercase" style={{ color: st === "fresh" ? "#86efac" : st === "aging" ? "#fcd34d" : "#fff" }}>{st}</span>
              </div>
            );
          })}
          <button className="tabular text-[9px] text-caos-muted border border-caos-border rounded px-1 py-0.5 hover:text-caos-text hover:border-caos-accent/60 transition-caos">RE-RUN</button>
        </div>
      ))}
      <div className="flex gap-3 mt-2 px-1">
        {Object.keys(CELL_COLOR).map((k) => (
          <span key={k} className="flex items-center gap-1 text-[9px] text-caos-muted"><span className="w-2 h-2 rounded-sm" style={{ background: CELL_COLOR[k] }}></span>{k}</span>
        ))}
      </div>
    </div>
  );
}

export function QaQueue() {
  return (
    <div>
      {QA_QUEUE.map((q) => (
        <div key={q.id} className="px-3 py-[6px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos cursor-pointer">
          <div className="flex items-center gap-2">
            <Tag sev={q.sev === "HIGH" ? "critical" : q.sev === "MEDIUM" ? "warning" : "low"}>{q.sev}</Tag>
            <span className="tabular text-[10px] text-caos-accent">{q.id}</span>
            <span className="tabular text-[10px] text-caos-muted">{q.issuer} · {q.module}</span>
            <span className="tabular text-[9px] text-caos-muted ml-auto">{q.age}</span>
          </div>
          <div className="text-[10.5px] text-caos-text leading-snug mt-1">{q.text}</div>
        </div>
      ))}
    </div>
  );
}

export function GapsList() {
  return (
    <div>
      {GAPS.map((g, i) => (
        <div key={i} className="px-3 py-[6px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos">
          <div className="flex items-center gap-2">
            <Dot sev={g.sev} />
            <span className="tabular text-[10px] text-caos-accent">{g.issuer}</span>
            <span className="text-[10.5px] text-caos-text truncate">{g.doc}</span>
            <span className="tabular text-[9px] text-caos-muted ml-auto">req. {g.requested}</span>
          </div>
          <div className="text-[9.5px] text-caos-muted leading-snug mt-0.5 pl-3.5">{g.impact}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- footer detail strip ---------- */
export function IssuerStrip({ code, onClose }: { code: string; onClose: () => void }) {
  const p = PORTFOLIO.find((x) => x.code === code);
  if (!p) return null;
  const stat = (l: string, v: string, c?: string) => (
    <span key={l} className="flex flex-col items-start">
      <span className="tabular text-[8.5px] uppercase tracking-wider text-caos-muted">{l}</span>
      <span className="tabular text-[12px]" style={{ color: c }}>{v}</span>
    </span>
  );
  return (
    <div className="h-12 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-6 px-4 caos-enter">
      <span className="flex items-center gap-2">
        <span className="tabular text-[12px] text-caos-accent">{p.code}</span>
        <span className="text-[12px] text-caos-text font-medium">{p.name}</span>
        <Tag sev={p.qa}>{p.qa}</Tag>
      </span>
      {stat("STW", p.stw + "bps")}
      {stat("YTW", p.ytw.toFixed(2) + "%")}
      {stat("Net Lev", p.lev.toFixed(1) + "x")}
      {stat("Int Cov", p.cov.toFixed(1) + "x")}
      {stat("M2E", p.m2e.toFixed(1) + "mo", p.m2e < 12 ? "var(--caos-warning)" : undefined)}
      {stat("Posture", p.posture, POSTURE_COLOR[p.posture])}
      <div className="flex-1"></div>
      {p.code === "ATLF" ? (
        <Link href="/deepdive" className="no-underline tabular text-[10px] px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
          OPEN DEEP-DIVE →
        </Link>
      ) : (
        <span className="tabular text-[9px] text-caos-muted">deep-dive mocked for ATLF only</span>
      )}
      <button onClick={onClose} className="text-caos-muted hover:text-caos-text transition-caos text-[11px]">✕</button>
    </div>
  );
}
