"use client";

// Shared status atoms for the Pipeline Visualizer (port of design bundle shared/ui.jsx).

import { type SimRun } from "@/lib/pipeline/sim";
import { sevSurface, sevVar } from "@/lib/pipeline/sev";
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
export function Dot({ sev, pulse, glyph }: { sev?: string; pulse?: boolean; glyph?: boolean }) {
  const s = sev || "idle";
  const color = sevVar(s);
  if (glyph) {
    const kind = SEV_GLYPH[s] ?? "idle";
    return (
      <span
        aria-hidden="true"
        className={"inline-flex shrink-0 " + (pulse ? "caos-running" : "")}
        style={{ color }}
      >
        <StatusGlyph kind={kind} size={10} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={"inline-block w-1.5 h-1.5 rounded-full shrink-0 " + (pulse ? "caos-running" : "")}
      style={{ background: color }}
    />
  );
}

export function Tag({ sev, children }: { sev?: string; children: React.ReactNode }) {
  const s = sev || "idle";
  const { color: c, borderColor, background } = sevSurface(s);
  const isIdle = s === "idle" || s === "queued" || c === "var(--caos-idle)";
  const textColor = isIdle ? "var(--caos-muted)" : c;
  return (
    <span
      className="tabular text-caos-xs uppercase tracking-wider px-1.5 py-px rounded border inline-flex items-center gap-1 whitespace-nowrap"
      style={{ color: textColor, borderColor, background }}
    >
      {children}
    </span>
  );
}

export function Bar({ pct, color = "var(--caos-accent)", h = 3 }: { pct: number; color?: string; h?: number }) {
  const safePct = typeof pct === "number" && !isNaN(pct) && isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const safeHeight = typeof h === "number" && !isNaN(h) && h >= 0 ? h : 3;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: safeHeight, background: "var(--caos-border)" }}>
      <div className="h-full rounded-full transition-caos" style={{ width: safePct + "%", background: color }} />
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
  if (!options || !Array.isArray(options)) return null;

  const pad = size === "sm" ? "text-caos-sm px-2.5 py-[7px]" : "text-caos-md px-3 py-1.5";
  return (
    <div 
      className={"flex items-center rounded border border-caos-border overflow-hidden " + className}
      role="group"
      aria-label="Toggle options"
    >
      {options.map((o) => (
        <button
          key={String(o.k)}
          type="button"
          onClick={() => onChange(o.k)}
          title={o.title}
          aria-label={o.title || o.l}
          aria-pressed={value === o.k}
          className={
            "tabular whitespace-nowrap transition-caos focus-ring " +
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

const SPEED_OPTIONS = [1, 2, 4] as const;

export function SimControls({ run }: { run?: SimRun }) {
  if (!run || !run.sim) return null;

  const isPlaying = !!run.playing;
  const isDone = !!run.sim.done;
  const currentSpeed = run.speed ?? 1;

  // At completion, ▶ replays from the top (run.reset restarts and autoplays) —
  // otherwise the button silently does nothing once the sim is done, since the
  // step loop is gated on !sim.done. Mid-run it toggles play/pause as usual.
  const playPauseTitle = isDone ? "Replay simulation" : isPlaying ? "Pause simulation" : "Play simulation";
  const onPlayPause = () => (isDone ? run.reset() : run.setPlaying(!isPlaying));
  const showPause = isPlaying && !isDone;

  return (
    <div className="flex items-center gap-1.5" role="toolbar" aria-label="Simulation Controls">
      <button
        type="button"
        onClick={onPlayPause}
        className="w-6 h-6 rounded border border-caos-border bg-caos-elevated flex items-center justify-center text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
        title={playPauseTitle}
        aria-label={playPauseTitle}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="w-3 h-3 fill-current">
          {showPause ? (
            <>
              <rect x="4" y="3" width="3" height="10" rx="0.5" />
              <rect x="9" y="3" width="3" height="10" rx="0.5" />
            </>
          ) : (
            <path d="M5 3.2v9.6a.6.6 0 0 0 .92.5l7.4-4.8a.6.6 0 0 0 0-1L5.92 2.7A.6.6 0 0 0 5 3.2Z" />
          )}
        </svg>
      </button>
      <button
        type="button"
        onClick={run.reset}
        className="w-6 h-6 rounded border border-caos-border bg-caos-elevated flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
        title="Reset run"
        aria-label="Reset run"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="w-3.5 h-3.5 stroke-current" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 5.5A5 5 0 1 0 13 9" />
          <path d="M12.7 2.6v3h-3" />
        </svg>
      </button>
      {SPEED_OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => run.setSpeed(s)}
          className={
            "tabular text-caos-md px-1.5 h-6 rounded border transition-caos focus-ring " +
            (currentSpeed === s ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
          aria-label={`Speed ${s}x`}
          aria-pressed={currentSpeed === s}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}
