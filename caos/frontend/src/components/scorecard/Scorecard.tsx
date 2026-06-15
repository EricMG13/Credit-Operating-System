"use client";

// Loan Scorecard view — renders the documentation-protection score for one deal
// on the 1 (most protective) → 5 (deficient) scale: a Composite hero, the 5
// Sub-Scores (expandable to their input drivers), and the 6 Quality Scores.
// Status is never color-only (a11y): every score pairs its hue with the band
// label and a glyph, and shows the numeric on a labeled scale. Data is
// /api/scorecard/{deal_id}; see docs/SCORECARD_SCHEMA.md.

import { useState } from "react";
import type { Scorecard, ScoreResult } from "@/lib/scorecard/types";

// Band → { color token, glyph } so meaning is carried by label + shape, not hue.
function bandStyle(band: string | null): { cls: string; glyph: string } {
  switch (band) {
    case "Strongly protective":
      return { cls: "text-caos-success", glyph: "▲" };
    case "Protective":
      return { cls: "text-caos-success", glyph: "△" };
    case "Balanced":
      return { cls: "text-caos-accent", glyph: "◆" };
    case "Weak":
      return { cls: "text-caos-warning", glyph: "▽" };
    case "Deficient":
      return { cls: "text-caos-critical", glyph: "▼" };
    default:
      return { cls: "text-caos-muted", glyph: "·" };
  }
}

function ScaleBar({ value }: { value: number }) {
  // 1 (left, protective) → 5 (right, deficient). Marker at the value position.
  const pct = ((value - 1) / 4) * 100;
  return (
    <div className="relative h-1.5 rounded-full bg-caos-elevated overflow-visible">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-caos-success via-caos-warning to-caos-critical opacity-30"
        style={{ width: "100%" }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-caos-bg bg-caos-text"
        style={{ left: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function Chip({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title}
      className="tabular text-[8.5px] uppercase tracking-wider text-caos-muted border border-caos-border rounded px-1.5 py-0.5 whitespace-nowrap"
    >
      {label}
    </span>
  );
}

function basisLabel(basis: string): string {
  return basis === "covenant_review" ? "Covenant review" : basis === "methodology" ? "Methodology" : basis === "mixed" ? "Mixed" : "—";
}

function ScoreLine({ s, expandable = true }: { s: ScoreResult; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const bs = bandStyle(s.band);
  const insufficient = s.value === null;
  return (
    <div className="border-b border-caos-border/60 last:border-0">
      <button
        type="button"
        disabled={!expandable || !s.drivers.length}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 py-2 px-1 text-left transition-caos hover:bg-caos-elevated/40 disabled:cursor-default"
        aria-expanded={open}
      >
        <span className="flex-1 min-w-0 text-caos-body text-caos-text truncate">{s.label}</span>
        {insufficient ? (
          <span className="tabular text-[10px] uppercase tracking-wider text-caos-muted">Insufficient data</span>
        ) : (
          <>
            <span className="w-28 shrink-0 hidden sm:block">
              <ScaleBar value={s.value as number} />
            </span>
            <span className={"tabular text-[11px] tabular-nums " + bs.cls} aria-hidden="true">{bs.glyph}</span>
            <span className={"tabular text-[13px] font-semibold tabular-nums w-8 text-right " + bs.cls}>
              {(s.value as number).toFixed(1)}
            </span>
            <span className={"text-[9.5px] w-32 shrink-0 hidden md:block " + bs.cls}>{s.band}</span>
          </>
        )}
        <Chip label={s.confidence === "Insufficient Information" ? "Insuff." : s.confidence} title="Confidence" />
        {expandable && s.drivers.length ? (
          <span className="tabular text-caos-muted text-[10px] w-3 text-center">{open ? "−" : "+"}</span>
        ) : (
          <span className="w-3" />
        )}
      </button>
      {open && s.drivers.length ? (
        <div className="pb-2 pl-3 pr-4 space-y-1">
          {s.drivers.map((d, i) => (
            <div key={i} className="flex items-baseline gap-2 text-caos-micro">
              <span className="text-caos-muted flex-1 min-w-0 truncate">{d.label}</span>
              <span className="text-caos-text tabular">{d.detail}</span>
              {d.contribution != null ? (
                <span className={"tabular tabular-nums w-7 text-right " + bandStyle(null).cls}>
                  {d.contribution.toFixed(1)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ScorecardView({ card }: { card: Scorecard }) {
  const c = card.composite;
  const cb = bandStyle(c.band);
  const methodology = card.basis === "methodology";

  return (
    <div className="h-full overflow-auto px-1">
      {/* Composite hero */}
      <div className="flex items-stretch gap-5 p-4 border-b border-caos-border">
        <div className="flex flex-col justify-center min-w-[120px]">
          <div className="text-caos-micro uppercase tracking-wider text-caos-muted">Composite</div>
          {c.value === null ? (
            <div className="text-caos-muted text-[20px] font-semibold mt-1">—</div>
          ) : (
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={"tabular-nums text-[34px] leading-none font-bold " + cb.cls}>
                {c.value.toFixed(1)}
              </span>
              <span className="tabular text-caos-muted text-[11px]">/ 5</span>
            </div>
          )}
          <div className={"text-[11px] mt-1 " + cb.cls}>
            <span aria-hidden="true">{cb.glyph} </span>
            {c.band ?? "Insufficient data"}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
          {c.value !== null ? <ScaleBar value={c.value} /> : null}
          <div className="flex items-center justify-between text-caos-micro text-caos-muted tabular">
            <span>1 · Most protective</span>
            <span>5 · Seriously deficient</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip label={basisLabel(card.basis)} title="Scoring basis" />
            <Chip label={c.confidence === "Insufficient Information" ? "Insuff. confidence" : c.confidence + " confidence"} />
            {card.seniority ? <Chip label={card.seniority} title="Collateral seniority" /> : null}
          </div>
        </div>
      </div>

      {/* Methodology-derived banner (the no-covenant-review-doc fallback) */}
      {methodology ? (
        <div
          className="mx-4 my-3 rounded border border-caos-warning/40 bg-caos-warning/10 px-3 py-2 text-caos-body text-caos-text"
          role="note"
        >
          <span className="text-caos-warning font-medium">Methodology-derived.</span>{" "}
          No covenant-review document was provided — scored from the empirical signals CAOS derives
          (collateral package, cov-lite, leverage, day-one capacity, call protection). Qualitative
          categories are approximated and confidence is reduced. Attach a covenant-review document to
          ground the score.
        </div>
      ) : null}

      {/* Sub-scores */}
      <Section title="Sub-Scores">
        {card.sub_scores.map((s) => (
          <ScoreLine key={s.key} s={s} />
        ))}
      </Section>

      {/* Quality scores */}
      <Section title="Quality Scores">
        {card.quality_scores.map((q) => (
          <ScoreLine key={q.key} s={q} />
        ))}
      </Section>

      {/* Limitations */}
      {card.limitation_flags.length ? (
        <div className="px-4 py-3 space-y-1">
          {card.limitation_flags.map((f, i) => (
            <div key={i} className="text-caos-micro text-caos-muted flex gap-2">
              <span aria-hidden="true">⚠</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <div className="text-caos-micro uppercase tracking-wider text-caos-muted mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}
