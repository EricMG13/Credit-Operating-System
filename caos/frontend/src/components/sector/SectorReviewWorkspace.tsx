"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { Panel } from "@/components/shared/Panel";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { ResponsiveShell, type NarrowContract } from "@/components/shared/ResponsiveShell";
import {
  askSectorTopic,
  getSectorFeeds,
  getSectorReview,
  getSectorSignals,
  refreshSectorReview,
  toErrorMessage,
  updateSectorFeeds,
  type SectorAskResponse,
  type SectorFeed,
  type SectorReview,
  type SectorSignal,
  type SectorSource,
} from "@/lib/api";

const TIMEFRAMES = [
  ["today", "Today"],
  ["3d", "3D"],
  ["1w", "1W"],
  ["1m", "1M"],
  ["custom", "Custom"],
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  earnings: "Earnings",
  liquidity: "Liquidity",
  rating: "Rating",
  macro: "Macro",
  technical: "Technical",
  covenant: "Covenant",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--caos-critical)",
  high: "var(--caos-warning)",
  medium: "var(--caos-accent)",
  low: "var(--caos-muted)",
};

const SEVERITY_GLYPH: Record<string, "critical" | "warning" | "idle"> = {
  critical: "critical",
  high: "warning",
  medium: "warning",
  low: "idle",
};

const fmtAsOf = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

function SourceChip({ source }: { source: SectorSource }) {
  const label = `${source.source_type} / ${source.tier}`;
  const klass = "inline-flex items-center gap-1 rounded border border-caos-border px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider text-caos-muted";
  if (source.url) {
    return (
      <a href={source.url} className={klass + " hover:border-caos-accent hover:text-caos-text transition-caos"} title={source.title}>
        {label}
      </a>
    );
  }
  return (
    <span className={klass} title={`${source.title} (${source.ref})`}>
      {label}
    </span>
  );
}

function ProvenanceBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-caos-warning/50 bg-caos-warning/10 px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider text-caos-warning">
      <StatusGlyph kind="warning" size={8} />
      {value === "seed" ? "Seed / demo" : value}
    </span>
  );
}

function groupSignals(signals: SectorSignal[]) {
  const grouped = new Map<string, SectorSignal[]>();
  for (const signal of signals) {
    grouped.set(signal.category, [...(grouped.get(signal.category) || []), signal]);
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function SectorReviewWorkspace() {
  const [feeds, setFeeds] = useState<SectorFeed[]>([]);
  const [selectedSector, setSelectedSector] = useState("");
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number][0]>("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [review, setReview] = useState<SectorReview | null>(null);
  const [signals, setSignals] = useState<SectorSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingFeeds, setSavingFeeds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSignal, setAskSignal] = useState<SectorSignal | null>(null);
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState<SectorAskResponse | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSectorFeeds()
      .then((rows) => {
        if (cancelled) return;
        setFeeds(rows);
        const first = rows.find((row) => row.enabled) || rows[0];
        if (first && !selectedSector) setSelectedSector(first.sector);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err, "Could not load sector feeds."));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSector]);

  useEffect(() => {
    if (!selectedSector) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getSectorReview({
        sector: selectedSector,
        timeframe,
        as_of: timeframe === "custom" && toDate ? toDate : undefined,
      }),
      getSectorSignals({
        sector: selectedSector,
        from: timeframe === "custom" ? fromDate || undefined : undefined,
        to: timeframe === "custom" ? toDate || undefined : undefined,
        q: q || undefined,
        category: category || undefined,
        severity: severity || undefined,
        limit: 50,
      }),
    ])
      .then(([nextReview, nextSignals]) => {
        if (cancelled) return;
        setReview(nextReview);
        setSignals(nextSignals);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err, "Could not load Sector Review."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSector, timeframe, fromDate, toDate, q, category, severity]);

  const visibleSignals = signals;
  const grouped = useMemo(() => groupSignals(visibleSignals), [visibleSignals]);
  const categories = useMemo(() => Array.from(new Set((review?.signals || signals).map((s) => s.category))).sort(), [review, signals]);
  const severities = useMemo(() => Array.from(new Set((review?.signals || signals).map((s) => s.severity))).sort(), [review, signals]);

  const toggleFeed = async (feed: SectorFeed) => {
    const next = feeds.map((row) =>
      row.sector === feed.sector ? { ...row, enabled: !row.enabled, provenance: "profile" } : row
    );
    setFeeds(next);
    setSavingFeeds(true);
    try {
      const saved = await updateSectorFeeds(next);
      setFeeds(saved);
      if (!saved.some((row) => row.sector === selectedSector && row.enabled)) {
        setSelectedSector((saved.find((row) => row.enabled) || saved[0])?.sector || "");
      }
    } catch (err) {
      setError(toErrorMessage(err, "Could not save sector feeds."));
    } finally {
      setSavingFeeds(false);
    }
  };

  const refresh = async () => {
    if (!selectedSector) return;
    setRefreshing(true);
    setError(null);
    try {
      const next = await refreshSectorReview({
        sector: selectedSector,
        timeframe,
        as_of: timeframe === "custom" && toDate ? toDate : undefined,
      });
      setReview(next);
      setSignals(next.signals);
    } catch (err) {
      setError(toErrorMessage(err, "Could not refresh Sector Review."));
    } finally {
      setRefreshing(false);
    }
  };

  const ask = async () => {
    if (!askSignal) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      setAskAnswer(await askSectorTopic(askSignal.id, askQuestion));
    } catch (err) {
      setError(toErrorMessage(err, "Could not run Sector ASK."));
    } finally {
      setAskLoading(false);
    }
  };

  const narrowContract: NarrowContract = {
    essentialControls: (
      <button
        type="button"
        onClick={refresh}
        disabled={!selectedSector || refreshing}
        className="rounded border border-caos-border px-2 py-1 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:text-caos-text hover:border-caos-accent/60 disabled:opacity-50 disabled:cursor-not-allowed transition-caos focus-ring"
      >
        {refreshing ? "Refreshing" : "Refresh"}
      </button>
    ),
  };

  return (
    <ResponsiveShell
      identity={
        <>
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
            ← Directory
          </Link>
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <ConceptNav compact />
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">CP-SR daily intelligence</span>
          <ProvenanceBadge value={review?.provenance || "seed"} />
          <span className="tabular text-caos-xs text-caos-muted">
            {review ? `As of ${fmtAsOf.format(new Date(review.as_of))}` : "Loading as-of"}
          </span>
        </>
      }
      contextualControls={
        <button
          type="button"
          onClick={refresh}
          disabled={!selectedSector || refreshing}
          className="rounded border border-caos-border px-2 py-1 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:text-caos-text hover:border-caos-accent/60 disabled:opacity-50 disabled:cursor-not-allowed transition-caos focus-ring"
        >
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      }
      narrowContract={narrowContract}
    >
      <div className="flex-1 min-h-0 p-2 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-2 overflow-hidden">
        <Panel
          title="Sector Feeds"
          className="min-h-0"
          right={savingFeeds ? <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">saving</span> : null}
        >
          <div className="p-2 flex flex-col gap-2">
            {feeds.map((feed) => (
              <label
                key={feed.sector}
                className={
                  "flex items-center gap-2 rounded border px-2 py-2 transition-caos cursor-pointer " +
                  (selectedSector === feed.sector
                    ? "border-caos-accent bg-caos-elevated/40"
                    : "border-caos-border bg-caos-bg hover:border-caos-accent/50")
                }
              >
                <input
                  type="checkbox"
                  checked={feed.enabled}
                  onChange={() => toggleFeed(feed)}
                  className="accent-[var(--caos-accent)] focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setSelectedSector(feed.sector)}
                  className="min-w-0 flex-1 text-left focus-ring rounded"
                >
                  <span className="block text-caos-sm font-medium truncate">{feed.sector}</span>
                  <span className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                    {feed.enabled ? "enabled" : "muted"} / {feed.provenance}
                  </span>
                </button>
              </label>
            ))}
            {!feeds.length ? (
              <div className="rounded border border-dashed border-caos-border p-3 text-caos-sm text-caos-muted">
                No sector feeds returned.
              </div>
            ) : null}
          </div>
        </Panel>

        <div className="min-h-0 flex flex-col gap-2">
          <Panel
            title="Sector Review"
            className="shrink-0"
            right={
              <button
                type="button"
                onClick={refresh}
                disabled={!selectedSector || refreshing}
                className="rounded border border-caos-border px-2 py-1 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:text-caos-text hover:border-caos-accent/60 disabled:opacity-50 disabled:cursor-not-allowed transition-caos focus-ring"
              >
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            }
          >
            <div className="p-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-caos-2xl font-semibold text-caos-text">{selectedSector || "No sector selected"}</h2>
                {review ? (
                  <>
                    <span className="rounded border border-caos-border px-2 py-0.5 tabular text-caos-xs uppercase tracking-wider text-caos-muted">
                      {review.posture}
                    </span>
                    <span className="rounded border border-caos-border px-2 py-0.5 tabular text-caos-xs uppercase tracking-wider text-caos-muted">
                      {review.module_status}
                    </span>
                    <ProvenanceBadge value={review.provenance} />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded border border-caos-border bg-caos-bg p-[2px] gap-0.5">
                  {TIMEFRAMES.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTimeframe(value)}
                      className={
                        "rounded-sm px-2.5 py-1 tabular text-caos-2xs uppercase tracking-wider transition-caos focus-ring " +
                        (timeframe === value ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {timeframe === "custom" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="rounded border border-caos-border bg-caos-bg px-2 py-1 tabular text-caos-xs text-caos-text focus-ring"
                      aria-label="Sector Review start date"
                    />
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="rounded border border-caos-border bg-caos-bg px-2 py-1 tabular text-caos-xs text-caos-text focus-ring"
                      aria-label="Sector Review end date"
                    />
                  </div>
                ) : null}
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search signals"
                  className="min-w-48 rounded border border-caos-border bg-caos-bg px-2 py-1 tabular text-caos-xs text-caos-text placeholder:text-caos-muted focus-ring"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded border border-caos-border bg-caos-bg px-2 py-1 tabular text-caos-xs text-caos-text focus-ring"
                  aria-label="Filter by category"
                >
                  <option value="">All categories</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>{CATEGORY_LABEL[value] || value}</option>
                  ))}
                </select>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="rounded border border-caos-border bg-caos-bg px-2 py-1 tabular text-caos-xs text-caos-text focus-ring"
                  aria-label="Filter by severity"
                >
                  <option value="">All severities</option>
                  {severities.map((value) => (
                    <option key={value} value={value}>{value.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              {error ? (
                <div className="rounded border border-caos-critical/60 bg-caos-critical/10 p-2 text-caos-sm text-caos-critical">
                  {error}
                </div>
              ) : null}
              {review?.staleness_flag === "seed" ? (
                <div className="rounded border border-caos-warning/50 bg-caos-warning/10 p-2 text-caos-sm text-caos-warning">
                  Seed fixture only. CP-SR remains pending until live and deterministic offline synthesis emit schema-valid sector_review payloads.
                </div>
              ) : null}
            </div>
          </Panel>

          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-2 min-h-0">
            <Panel title="Daily Signal Cards" className="min-h-0">
              <div className="p-2 flex flex-col gap-3">
                {loading ? (
                  <div className="rounded border border-caos-border bg-caos-bg p-3 text-caos-sm text-caos-muted">
                    Loading Sector Review.
                  </div>
                ) : grouped.length ? grouped.map(([group, rows]) => (
                  <section key={group} className="flex flex-col gap-2">
                    <h3 className="px-1 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                      {CATEGORY_LABEL[group] || group} / {rows.length}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {rows.map((signal) => (
                        <article key={signal.id} className="rounded-md border border-caos-border bg-caos-bg p-3 flex flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 inline-flex items-center gap-1 rounded border border-caos-border px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider"
                              style={{ color: SEVERITY_COLOR[signal.severity] || "var(--caos-muted)" }}
                            >
                              <StatusGlyph kind={SEVERITY_GLYPH[signal.severity] || "idle"} size={8} />
                              {signal.severity}
                            </span>
                            <h4 className="m-0 flex-1 text-caos-md font-semibold leading-snug text-caos-text">{signal.headline}</h4>
                          </div>
                          <p className="m-0 text-caos-sm leading-relaxed text-caos-muted">{signal.summary}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {signal.issuers.map((issuer) => (
                              <IssuerLink
                                key={`${signal.id}-${issuer.name}`}
                                query={issuer.name}
                                className="rounded border border-caos-border px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider text-caos-accent hover:text-caos-text hover:border-caos-accent transition-caos"
                              >
                                {issuer.ticker || issuer.name} / {issuer.exposure}
                              </IssuerLink>
                            ))}
                            {signal.sources.map((source) => (
                              <SourceChip key={`${signal.id}-${source.ref}`} source={source} />
                            ))}
                            <ProvenanceBadge value={signal.provenance} />
                          </div>
                          <div className="flex items-center gap-3 pt-1 border-t border-caos-border/60">
                            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                              Score {Math.round(signal.materiality_score * 100)}
                            </span>
                            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                              {fmtAsOf.format(new Date(signal.signal_date))}
                            </span>
                            <span className="flex-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setAskSignal(signal);
                                setAskQuestion(`What is the credit impact of ${signal.headline}?`);
                                setAskAnswer(null);
                              }}
                              className="rounded border border-caos-border px-2 py-1 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:border-caos-accent hover:text-caos-text transition-caos focus-ring"
                            >
                              Ask Topic
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )) : (
                  <div className="rounded border border-dashed border-caos-border bg-caos-bg p-4 text-caos-sm text-caos-muted">
                    No sector signals match this feed and filter set.
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Seven-Section Envelope" className="min-h-0">
              <div className="p-2 flex flex-col gap-2">
                {(review?.sections || []).map((section) => (
                  <div key={section.id} className="rounded border border-caos-border bg-caos-bg p-2">
                    <div className="flex items-center gap-2">
                      <h3 className="m-0 text-caos-sm font-semibold text-caos-text">{section.title}</h3>
                      <span className="ml-auto tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{section.posture}</span>
                    </div>
                    <p className="m-0 mt-1 text-caos-xs leading-relaxed text-caos-muted">{section.summary}</p>
                    {section.signal_ids.length ? (
                      <div className="mt-2 tabular text-caos-2xs uppercase tracking-wider text-caos-accent">
                        {section.signal_ids.length} linked signal{section.signal_ids.length === 1 ? "" : "s"}
                      </div>
                    ) : null}
                  </div>
                ))}
                {!review?.sections.length ? (
                  <div className="rounded border border-dashed border-caos-border p-3 text-caos-sm text-caos-muted">
                    No CP-SR envelope returned.
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {askSignal ? (
        <div className="fixed inset-0 z-overlay bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Sector topic ASK">
          <div className="w-full max-w-2xl rounded-md border border-caos-border bg-caos-panel shadow-lg">
            <div className="h-9 px-3 border-b border-caos-border flex items-center gap-2">
              <h2 className="m-0 text-caos-md font-semibold uppercase tracking-[0.12em] text-caos-muted">Topic ASK</h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setAskSignal(null)}
                className="rounded px-2 py-1 tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring"
                aria-label="Close Sector topic ASK"
              >
                X
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div>
                <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{askSignal.sector} / {askSignal.category}</div>
                <div className="text-caos-md font-semibold text-caos-text">{askSignal.headline}</div>
              </div>
              <textarea
                value={askQuestion}
                onChange={(e) => setAskQuestion(e.target.value)}
                rows={3}
                className="w-full rounded border border-caos-border bg-caos-bg p-2 text-caos-sm text-caos-text focus-ring"
              />
              <button
                type="button"
                onClick={ask}
                disabled={askLoading}
                className="self-start rounded border border-caos-border px-3 py-1.5 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:border-caos-accent hover:text-caos-text disabled:opacity-50 transition-caos focus-ring"
              >
                {askLoading ? "Running" : "Run Topic ASK"}
              </button>
              {askAnswer ? (
                <div className="rounded border border-caos-border bg-caos-bg p-3 flex flex-col gap-2">
                  <p className="m-0 text-caos-sm leading-relaxed text-caos-text">{askAnswer.answer}</p>
                  <p className="m-0 text-caos-sm leading-relaxed text-caos-muted">{askAnswer.financial_impact_summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {askAnswer.sources.map((source) => <SourceChip key={source.ref} source={source} />)}
                    <ProvenanceBadge value={askAnswer.provenance} />
                  </div>
                  <div className="rounded border border-caos-border/70 p-2 text-caos-xs leading-relaxed text-caos-muted">
                    {askAnswer.retrieval_scope}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </ResponsiveShell>
  );
}
