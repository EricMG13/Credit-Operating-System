"use client";

// Shared status atoms for the Pipeline Visualizer (port of design bundle shared/ui.jsx).

import { type SimRun } from "@/lib/pipeline/sim";
import { SEV_COLOR } from "@/lib/pipeline/sev";
import { StatusGlyph } from "@/components/shared/StatusGlyph";

// Severity → the StatusGlyph kind that draws its shape, so a status can be read
// without relying on the dot color alone. Severities that share a glyph map to
// the same mark (high/medium → warning, pass/ok/clear → success).
const SEV_GLYPH: Record<string, "critical" | "warning" | "success" | "running" | "idle" | "held" | "blocked"> = {
  critical: "critical", blocked: "blocked", high: "warning", warning: "warning",
  medium: "warning", conditional: "warning", held: "held",
  ok: "success", pass: "success", clear: "success",
  running: "running", info: "running", low: "idle", idle: "idle", queued: "idle",
};

// A small status indicator. By default a bare color dot (dense inline use, where
// an adjacent text label carries the meaning). Pass `glyph` to draw the severity
// shape instead — for places where the dot would otherwise be the SOLE carrier
// of status, so meaning is never color-alone (Blueprint a11y).
export function Dot({ sev, pulse, glyph }: { sev: string; pulse?: boolean; glyph?: boolean }) {
  if (glyph) {
    const kind = SEV_GLYPH[sev] ?? "idle";
    return (
      <span
        className={"inline-flex shrink-0 " + (pulse ? "caos-running" : "")}
        style={{ color: SEV_COLOR[sev] || "var(--caos-idle)" }}
      >
        <StatusGlyph kind={kind} size={10} />
      </span>
    );
  }
  return (
    <span
      className={"inline-block w-1.5 h-1.5 rounded-full shrink-0 " + (pulse ? "caos-running" : "")}
      style={{ background: SEV_COLOR[sev] || "var(--caos-idle)" }}
    />
  );
}

export function Tag({ sev, children }: { sev: string; children: React.ReactNode }) {
  const c = SEV_COLOR[sev] || "var(--caos-muted)";
  return (
    <span
      className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border inline-flex items-center gap-1 whitespace-nowrap"
      style={{ color: c, borderColor: c + "55", background: c + "14" }}
    >
      {children}
    </span>
  );
}

export function Bar({ pct, color = "var(--caos-accent)", h = 3 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: h, background: "var(--caos-border)" }}>
      <div className="h-full rounded-full transition-caos" style={{ width: Math.max(0, Math.min(100, pct)) + "%", background: color }} />
    </div>
  );
}

// Segmented button group used across the desk sub-headers (source/mode/view
// switchers). `size` "sm" matches the dense pipeline header toggles, "md" the
// view switchers. Key type allows boolean (LIVE/DEMO) as well as string ids.
export function ToggleGroup<K extends string | boolean>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  options: readonly { k: K; l: string; title?: string }[];
  value: K;
  onChange: (k: K) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "text-caos-sm px-2.5 py-[7px]" : "text-caos-md px-3 py-1.5";
  return (
    <div className={"flex items-center rounded border border-caos-border overflow-hidden " + className}>
      {options.map((o) => (
        <button
          key={String(o.k)}
          onClick={() => onChange(o.k)}
          title={o.title}
          className={
            "tabular whitespace-nowrap transition-caos " +
            pad +
            (value === o.k ? " bg-caos-elevated text-caos-text" : " text-caos-muted hover:text-caos-text")
          }
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function SimControls({ run }: { run: SimRun }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => run.setPlaying(!run.playing)}
        className="w-6 h-6 rounded border border-caos-border bg-caos-elevated flex items-center justify-center text-caos-text hover:border-caos-accent/60 transition-caos text-caos-xs"
        title={run.playing ? "Pause simulation" : "Play simulation"}
      >
        {run.playing && !run.sim.done ? "❚❚" : "▶"}
      </button>
      <button
        onClick={run.reset}
        className="w-6 h-6 rounded border border-caos-border bg-caos-elevated flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-caos-md"
        title="Reset run"
      >
        ↺
      </button>
      {[1, 2, 4].map((s) => (
        <button
          key={s}
          onClick={() => run.setSpeed(s)}
          className={
            "tabular text-caos-md px-1.5 h-6 rounded border transition-caos " +
            (run.speed === s ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          {s}×
        </button>
      ))}
    </div>
  );
}
