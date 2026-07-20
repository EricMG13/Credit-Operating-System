"use client";

import { useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { onActivate } from "@/lib/a11y";
import {
  ALERTS, EMAIL_TILES, EMAIL_TOTAL, EMAILS, FEED_LINKABLE_ISSUERS,
  type EmailRow,
} from "@/lib/command/monitor-data";
import { simClock } from "@/lib/pipeline/sim-engine";
import { SEV_COLOR, sevSurface } from "@/lib/pipeline/sev";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { useModalA11y } from "@/lib/use-modal-a11y";

/* ---------- CP-MON email viewer window ---------- */
function EmailWindow({ email, onClose }: { email: EmailRow; onClose: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <ModalBackdrop onClose={onClose} padded>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Email: ${email.subj}`}
        onClick={(e) => e.stopPropagation()}
        className="caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {/* window chrome */}
        <div className="h-9 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/60 shrink-0">
          <Dot sev={email.sev} />
          <span className="tabular text-caos-xl text-caos-text truncate">{email.subj}</span>
          <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-muted whitespace-nowrap">
            CP-MON · mat {email.mat}
          </span>
          <div className="flex-1" />
          <CloseButton onClick={onClose} title="Close (Esc)" />
        </div>

        {/* envelope */}
        <div className="px-4 py-2.5 border-b border-caos-border shrink-0 text-caos-md leading-relaxed">
          <div className="grid grid-cols-[52px_1fr] gap-x-2">
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">From</span>
            <span className="text-caos-text truncate">{email.from} <span className="text-caos-muted">· {email.src}</span></span>
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">To</span>
            <span className="text-caos-muted truncate">{email.to}</span>
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Time</span>
            <span className="text-caos-muted">{email.t} ET · today</span>
          </div>
        </div>

        {/* body — a reading surface, not a workspace cell: row size (12px) and a
            capped measure. The analyst verifies claims by reading these; 10.5px
            at a ~110ch line under-served the primary persona. */}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <p className="text-caos-xl text-caos-text/90 leading-relaxed whitespace-pre-line max-w-[76ch]">{email.body}</p>
        </div>

        {/* CP-MON classification footer */}
        <div className="px-4 py-2 border-t border-caos-border bg-caos-elevated/40 shrink-0 flex items-center gap-2 flex-wrap">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">CP-MON classification</span>
          {/* Profile chip only when the issuer resolves; illustrative names get a
              plain chip — no invited dead-ends (see FEED_LINKABLE_ISSUERS). */}
          {FEED_LINKABLE_ISSUERS.has(email.issuer) ? (
            <IssuerLink query={email.issuer} title={`Open ${email.issuer} profile`} className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-accent hover:text-caos-text hover:border-caos-accent/60 transition-caos">{email.issuer}</IssuerLink>
          ) : (
            <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-text">{email.issuer}</span>
          )}
          <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-muted">{email.signal}</span>
          <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border" style={{ color: SEV_COLOR[email.sev] }}>
            {email.sev.toUpperCase()} · {email.mat}
          </span>
          {email.dedup ? (
            <span className="tabular text-caos-xs px-1.5 py-px rounded border border-caos-border text-caos-muted">DEDUPED · CP-MON-F</span>
          ) : null}
          <span className="flex-1" />
          <span className="tabular text-caos-xs text-caos-muted">routed → {email.route}</span>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* ---------- CP-MON email intelligence ---------- */
export function EmailIntel() {
  const [filter, setFilter] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  // Tiles are the day's FIXED end-of-day classification (a truthful replay, not a
  // live accrual): critical+high+medium+low === EMAIL_TOTAL (105). They no longer
  // drift past the "Msgs today" header — the numbers reconcile by construction.
  // Weighted by SEVERITY, not count, so the eye lands on what must be acted on
  // (CRITICAL largest) rather than on the biggest number (the 64 auto-filed).
  const tiles = [
    { k: "critical", label: "Critical", n: EMAIL_TILES.critical, sub: "≥ 90 mat.", on: true, fs: "text-caos-hero", color: SEV_COLOR.critical },
    { k: "high", label: "High", n: EMAIL_TILES.high, sub: "70–89", on: true, fs: "text-caos-metric-lg", color: SEV_COLOR.high },
    { k: "medium", label: "Medium", n: EMAIL_TILES.medium, sub: "40–69", on: true, fs: "text-caos-metric", color: SEV_COLOR.medium },
    { k: "low", label: "Low", n: EMAIL_TILES.low, sub: "< 40 · filed", on: true, fs: "text-caos-xl", color: "var(--caos-muted)" },
    { k: "dedup", label: "Deduped", n: EMAIL_TILES.dedup, sub: "CP-MON-F", on: false, fs: "text-caos-xl", color: "var(--caos-muted)" },
    { k: "unresolved", label: "Unresolved", n: EMAIL_TILES.unresolved, sub: "issuer match", on: false, fs: "text-caos-xl", color: "var(--caos-text)" },
  ];
  const list = EMAILS.filter((e) => !filter || e.sev === filter);
  const activeTile = tiles.find((t) => t.k === filter);
  // The row list is an illustrative SAMPLE of the day's intake, not the full 105.
  // A persistent "showing N of M" caption pre-empts the "why does the Critical
  // tile say 3 but I only see 2 rows?" credibility hit.
  const sampleTotal = activeTile ? activeTile.n : EMAIL_TOTAL;
  const sampleScope = activeTile ? `${activeTile.label.toLowerCase()} · sample` : "today · sample";
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid gap-1.5 p-2 shrink-0" style={{ gridTemplateColumns: "1.35fr 1.15fr 1fr .85fr .85fr .9fr" }}>
        {tiles.map((t) => {
          const sel = filter === t.k;
          // Clickable severity tiles read as buttons (filled, hover, focus ring);
          // inert meta-tiles (deduped/unresolved) get a dashed, dimmed, label-like
          // treatment so the "which of these can I click?" question is answered by
          // sight, not by trial (the old build styled all six identically).
          const cls =
            "text-left rounded px-2 py-1.5 transition-caos " +
            (sel
              ? "caos-selected bg-caos-elevated border border-caos-accent "
              : t.on
                ? "bg-caos-bg border hover:bg-caos-elevated/70 focus-ring "
                // Dashed transparent border + no hover/focus signals "not a
                // button" WITHOUT dimming: opacity-70 here dropped muted text to
                // 4.15:1, under the 4.5:1 AA floor (axe color-contrast).
                : "bg-transparent border border-dashed border-caos-border/60 cursor-default ");
          const style = t.on && !sel ? { borderColor: sevSurface(t.k).borderColor } : undefined;
          const inner = (
            <>
              <div className={"tabular leading-none " + t.fs} style={{ color: t.color }}>{t.n}</div>
              <div className="text-caos-xs uppercase tracking-wider text-caos-muted mt-1">{t.label}</div>
              <div className="tabular text-caos-2xs text-caos-muted truncate">{t.sub}</div>
            </>
          );
          return t.on ? (
            <button
              key={t.k}
              onClick={() => setFilter(sel ? null : t.k)}
              aria-pressed={sel}
              // Explicit name — the visual stack ("3 / Critical / ≥ 90 mat.")
              // concatenates into mush in screen-reader output.
              aria-label={`${t.label}: ${t.n} messages (${t.sub}) — filter`}
              className={cls}
              style={style}
            >{inner}</button>
          ) : (
            <div key={t.k} className={cls} style={style}>{inner}</div>
          );
        })}
      </div>
      {/* Sample-size caption + one-click filter escape (user control & freedom).
          Sentence-case: this is a sentence, not a desk label — all-caps at this
          length reads as shouting (and trips the all-caps-body detector). */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-t border-caos-border text-caos-2xs text-caos-muted tabular">
        <span>Showing {list.length} of {sampleTotal} {sampleScope}</span>
        {filter ? (
          <button onClick={() => setFilter(null)} className="text-caos-accent hover:text-caos-text focus-ring rounded px-1">Clear filter</button>
        ) : null}
      </div>
      {/* Column headers — signal/mat/route were unlabeled columns; "mat 94" is
          the row's whole severity story and shouldn't require studying tile
          subtitles to decode (recognition over recall). */}
      <div className="shrink-0 grid grid-cols-[40px_46px_1fr_120px_40px_130px] gap-x-2 px-3 py-1 border-b border-caos-border/50 text-caos-2xs uppercase tracking-wider text-caos-muted tabular">
        <span>Time</span>
        <span>Issuer</span>
        {/* min-w-0 + truncate: degrade like the data rows when the 1fr column is
            starved (narrow panel) instead of wrapping to three lines. */}
        <span className="min-w-0 truncate">Subject · source</span>
        <span className="truncate">Signal</span>
        <span className="text-right" title="Materiality score (0–100); tiles above show the severity bands">Mat</span>
        <span className="text-right">Route</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {list.length === 0 ? (
          <div className="px-3 py-8 text-center text-caos-md text-caos-muted leading-relaxed">
            {activeTile?.n ?? 0} {activeTile?.label.toLowerCase()} messages auto-filed —<br />not retained in this illustrative sample.
          </div>
        ) : list.map((e, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setOpenEmail(e)}
            onKeyDown={onActivate(() => setOpenEmail(e))}
            aria-label={`Open email: ${e.subj}`}
            className="grid grid-cols-[40px_46px_1fr_120px_40px_130px] items-center gap-x-2 px-3 py-[3px] border-b border-caos-border/50 text-caos-md hover:bg-caos-elevated/60 transition-caos cursor-pointer focus-ring"
          >
            <span className="tabular text-caos-md text-caos-muted">{e.t}</span>
            {/* Issuer is identifying text, NOT a link — the whole row is the click
                target (opens the email). The issuer→profile jump lives on the
                accent chip inside the opened email, avoiding nested interactives. */}
            <span className="tabular text-caos-text">{e.issuer}</span>
            <span className="min-w-0">
              <span className="text-caos-text truncate block">{e.subj}{e.dedup ? <span className="text-caos-muted text-caos-xs"> · dup</span> : null}</span>
              <span className="text-caos-muted text-caos-xs truncate block">{e.src}</span>
            </span>
            <span className="text-caos-xs text-caos-muted truncate">{e.signal}</span>
            <span className="tabular text-right" style={{ color: SEV_COLOR[e.sev] }}>{e.mat}</span>
            <span className="tabular text-caos-xs text-caos-muted truncate text-right">→ {e.route}</span>
          </div>
        ))}
      </div>
      {openEmail ? <EmailWindow email={openEmail} onClose={() => setOpenEmail(null)} /> : null}
    </div>
  );
}

/* ---------- CP-MON live alert feed ---------- */
// Frozen per-alert arrival stamp. ALERTS is authored oldest→newest; each is
// offset a fixed step from the 09:30 open, so a given alert always shows the SAME
// time on every render. The old build recomputed `simClock(tick − i*5)` live, so
// every timestamp drifted forward each tick — the feed performed a liveness the
// "not live" marker disclaims. Stable index → stable stamp.
const ALERT_ARRIVAL_STEP = 5; // ticks between successive arrivals (× 7 sim-sec)
function alertArrival(i: number): string {
  return simClock(i * ALERT_ARRIVAL_STEP);
}

export function AlertFeed({ tick, running, done, sevFilter = null }: {
  tick: number; running: boolean; done: boolean; sevFilter?: string | null;
}) {
  // The alert row cites evidence and routes to a module; the "source" chip closes
  // the loop by opening the SAME EmailWindow the intake tape uses, so a critical
  // re-score is one interaction from the message that fired it (design principle
  // #3). Alerts with no triggering email render the chip disabled with a reason —
  // the no-dead-ends pattern mirroring FEED_LINKABLE_ISSUERS.
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  // Progressive reveal while the replay steps (the "arriving" feel); all rows once
  // it completes (a finished day shows the full routing log, even if it finished
  // before tick 40). Gating on `done` — not on "is running" — is what keeps the
  // arrival progressive instead of dumping all ten the instant play resumes.
  const visible = done ? ALERTS.length : Math.min(ALERTS.length, Math.floor(tick / 5) + 2);
  // Newest arrival on TOP (a feed's mental model). ALERTS is oldest→newest, so
  // reverse the revealed slice; each keeps its frozen index-based stamp. The
  // severity filter applies after reveal, so filtering never leaks unarrived rows.
  const rows = ALERTS.slice(0, visible)
    .map((a, i) => ({ a, at: alertArrival(i) }))
    .reverse()
    .filter(({ a }) => !sevFilter || a.sev === sevFilter);
  // pb-12: scroll room so the last row can clear the fixed Ask chip (bottom-right).
  return (
    <div className="pb-12" role="list" aria-label="Seeded demo alert replay (read-only)">
      {/* Honest read-only marker: these seeded rows can't be acknowledged —
          only the live AlertInbox above carries the selectable/ack path. */}
      <p className="px-3 py-1.5 tabular text-caos-2xs uppercase tracking-widest text-caos-muted border-b border-caos-border/40">
        Read-only replay — rows cannot be acknowledged.
      </p>
      {rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-caos-md text-caos-muted">
          No {sevFilter ?? ""} alerts routed yet.
        </div>
      ) : rows.map(({ a, at }, r) => {
        // Only the true newest row pulses, and only while the sim is actively
        // running — a completed replay is static, not perpetually "live".
        const isNewest = r === 0 && !sevFilter;
        // The intake message that fired this alert (undefined for derived alerts).
        const srcEmail = typeof a.sourceEmail === "number" ? EMAILS[a.sourceEmail] : undefined;
        return (
          <div key={a.code} role="listitem" className={"flex items-start gap-2 px-3 py-[6px] border-b border-caos-border/50 " + (isNewest && running ? "caos-enter" : "")}>
            <Dot sev={a.sev} pulse={isNewest && running} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {/* Issuer → profile link ONLY when the issuer resolves in the
                    register; the other seeded names render as plain text — an
                    accent link that dead-ends in "Issuer not found" is worse
                    than no link (it failed on both CRITICALs). Rows are inert
                    containers, so the link nests cleanly when present. */}
                {FEED_LINKABLE_ISSUERS.has(a.issuer) ? (
                  <IssuerLink query={a.issuer} title={`Open ${a.issuer} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos">
                    {a.issuer}
                  </IssuerLink>
                ) : (
                  <span className="tabular text-caos-md text-caos-text">{a.issuer}</span>
                )}
                {/* Severity as a labelled tag too — the dot's color isn't the only
                    carrier of severity (colorblind-safe). */}
                <Tag sev={a.sev}>{a.sev}</Tag>
                <span className="tabular text-caos-xs text-caos-muted">{a.code}</span>
                <span className="tabular text-caos-xs text-caos-muted ml-auto">{at}</span>
              </div>
              <div className="text-caos-md text-caos-text leading-snug mt-0.5">{a.text}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <Tag sev="info">route → {a.route}</Tag>
                {/* Source chip: opens the intake email that fired this alert —
                    same EmailWindow the tape uses, so evidence is one click away.
                    Disabled (with a reason) when the alert is derived and has no
                    single triggering message, mirroring the no-dead-ends pattern
                    used for the issuer chip above. */}
                {srcEmail ? (
                  <button
                    type="button"
                    onClick={() => setOpenEmail(srcEmail)}
                    title={`Open source message: ${srcEmail.subj}`}
                    aria-label={`Open source email for ${a.issuer} alert ${a.code}`}
                    className="inline-flex items-center gap-1 tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-accent hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring cursor-pointer"
                  >
                    <span aria-hidden="true">✉</span>
                    <span>Source</span>
                  </button>
                ) : (
                  <span
                    title="Derived alert — no single intake email; see CP-3 fair-value band"
                    aria-label="No source email — derived alert"
                    className="inline-flex items-center gap-1 tabular text-caos-2xs px-1.5 py-px rounded border border-dashed border-caos-border/60 text-caos-muted cursor-default"
                  >
                    <span aria-hidden="true">✉</span>
                    <span>No source</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {openEmail ? <EmailWindow email={openEmail} onClose={() => setOpenEmail(null)} /> : null}
    </div>
  );
}
