"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { headStat } from "@/components/shared/headStat";
import { getSectorFeeds, updateSectorFeeds, toErrorMessage, type SectorFeed } from "@/lib/api";
import {
  analysisApi,
  contextHref,
  useAnalysisContext,
  type AuthorityEnvelope,
  type SectorReviewV2,
} from "@/lib/analysis-workbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { useTypedUrlState } from "@/lib/typed-url-state";
import { fmtUtcDate } from "@/lib/format-date";

type Tab = "overview" | "signals" | "comparables" | "early-warning" | "risks" | "sources";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "signals", label: "Signals" },
  { id: "comparables", label: "Comparables" },
  { id: "early-warning", label: "Early Warning" },
  { id: "risks", label: "Risks" },
  { id: "sources", label: "Sources" },
];
const SECTOR_URL_KEYS = ["tab", "section", "compare"] as const;

function decisionAuthority(authority: AuthorityEnvelope): DecisionAuthority {
  return {
    provenance: {
      origin: authority.origin === "live" ? "LIVE" : authority.origin === "demo" ? "DEMO" : "REFERENCE",
      method: "DERIVED",
      freshness: authority.freshness === "current" ? "CURRENT" : authority.freshness === "stale" ? "STALE" : "UNKNOWN",
      detail: authority.method,
    },
    approval: authority.approval_state === "ratified" ? "RATIFIED" : authority.approval_state === "draft" ? "DRAFT" : "UNRATIFIED",
  };
}

function reviewDatum(review: SectorReviewV2 | null, value: React.ReactNode, fallback = "No versioned sector review in this context."): DecisionDatumState {
  if (!review) return { kind: "unavailable", message: fallback };
  const authority = decisionAuthority(review.authority);
  if (review.status === "partial") return { kind: "partial", value, missingSources: review.missing_dependencies, asOf: review.as_of, authority };
  if (review.status === "stale") return { kind: "stale", value, asOf: review.as_of, authority };
  if (review.status === "error") return { kind: "error", message: "Sector review failed; the prior version remains available." };
  return { kind: "ready", value, asOf: review.as_of, authority };
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="grid h-full place-items-center p-6 text-center text-caos-sm text-caos-muted">{text}</div>;
}

export function SectorReviewDossier() {
  const { roleView } = useRoleView();
  const contextState = useAnalysisContext({ name: "Telecom sector dossier", sector_id: "telecom" });
  const { values: urlState, update: updateUrlState } = useTypedUrlState(SECTOR_URL_KEYS);
  const [taxonomy, setTaxonomy] = useState<Array<{ id: string; label: string }>>([]);
  const [feeds, setFeeds] = useState<SectorFeed[]>([]);
  const [history, setHistory] = useState<SectorReviewV2[]>([]);
  const [review, setReview] = useState<SectorReviewV2 | null>(null);
  const tab: Tab = TABS.some((item) => item.id === urlState.tab) ? urlState.tab as Tab : roleView === "qa" ? "sources" : "overview";
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const compareVersion = urlState.compare ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analysisApi.getTaxonomy().then(setTaxonomy).catch(() => setTaxonomy([]));
    getSectorFeeds().then(setFeeds).catch(() => setFeeds([]));
  }, []);

  useEffect(() => {
    if (!contextState.context) return;
    analysisApi.listSectorReviews(contextState.context.id).then((rows) => {
      setHistory(rows);
      const active = rows.find((item) => item.id === contextState.context?.sector_review_run_id) ?? rows[0] ?? null;
      setReview(active);
      setSelectedSection(urlState.section ?? active?.sections[0]?.id ?? null);
    }).catch((reason) => setError(toErrorMessage(reason, "Sector review history unavailable.")));
  }, [contextState.context, urlState.section]);

  const requestRefresh = async () => {
    if (!contextState.context || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await analysisApi.createSectorReview({ context_id: contextState.context.id, sector_id: contextState.context.sector_id ?? undefined, timeframe: "weekly" });
      setReview(next);
      setSelectedSection(next.sections[0]?.id ?? null);
      setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      contextState.setContext({ ...contextState.context, sector_review_run_id: next.id });
    } catch (reason) {
      setError(toErrorMessage(reason, "Sector review refresh failed. The prior version is unchanged."));
    } finally {
      setBusy(false);
    }
  };

  const ratifySection = async (sectionId: string) => {
    if (!review || busy) return;
    setBusy(true);
    try {
      const next = await analysisApi.ratifySectorReview(review.id, [{ section_id: sectionId, decision: "ratified" }]);
      setReview(next);
    } catch (reason) {
      setError(toErrorMessage(reason, "Section ratification failed."));
    } finally { setBusy(false); }
  };

  const ratifyAll = async () => {
    if (!review || busy) return;
    setBusy(true);
    try {
      setReview(await analysisApi.ratifySectorReview(
        review.id,
        review.sections.map((section) => ({ section_id: section.id, decision: "ratified" as const })),
      ));
    } catch (reason) {
      setError(toErrorMessage(reason, "Review ratification failed."));
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (!review || busy) return;
    setBusy(true);
    try { setReview(await analysisApi.publishSectorReview(review.id)); }
    catch (reason) { setError(toErrorMessage(reason, "Publication gates are not satisfied.")); }
    finally { setBusy(false); }
  };

  const selectSector = async (sectorId: string) => {
    if (!contextState.context || sectorId === contextState.context.sector_id) return;
    setReview(null); setHistory([]); setSelectedSection(null); setError(null);
    await contextState.patch({ sector_id: sectorId, sector_review_run_id: null, rv_run_id: null });
  };

  const toggleFeed = async (sectorLabel: string) => {
    const current = feeds.find((feed) => feed.sector === sectorLabel);
    const next = [...feeds.filter((feed) => feed.sector !== sectorLabel), {
      sector: sectorLabel,
      enabled: !(current?.enabled ?? true),
      notify_pref: current?.notify_pref ?? "in_app",
      provenance: current?.provenance ?? "profile",
    }];
    try { setFeeds(await updateSectorFeeds(next)); }
    catch (reason) { setError(toErrorMessage(reason, "Feed preference could not be saved.")); }
  };

  const selected = review?.sections.find((section) => section.id === selectedSection) ?? review?.sections[0] ?? null;
  const compare = history.find((item) => item.id === compareVersion) ?? null;
  const decisionState: DecisionContextState = {
    whatChanged: reviewDatum(review, review?.what_changed, "No change observation — no versioned review in this context."),
    whyItMatters: reviewDatum(review, review?.why_it_matters, "No impact assessment yet — run a review to establish one."),
    requiredAction: reviewDatum(review, review?.required_action, "No required action — no review to act on."),
    evidenceHealth: reviewDatum(review, review?.evidence_health, "No evidence register — no review has been run."),
  };
  const context = contextState.context;
  const finalAction = !review || review.status === "partial" || review.status === "stale"
    ? <button type="button" data-page-primary-action onClick={() => void requestRefresh()} disabled={!context || busy} className="caos-action-primary focus-ring disabled:opacity-40">{busy ? "Refreshing…" : "Request refresh"}</button>
    : review.authority.approval_state === "ratified"
      ? <button type="button" data-page-primary-action onClick={() => void publish()} disabled={busy} className="caos-action-primary focus-ring disabled:opacity-40">Publish review</button>
      : <button type="button" data-page-primary-action onClick={() => void ratifyAll()} disabled={busy} className="caos-action-primary focus-ring disabled:opacity-40">Ratify updates</button>;

  return (
    <EnterprisePage
      kind="analytical"
      identity={<><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text">Sector Review</span>{review ? <span className="tabular text-caos-2xs text-caos-muted">{review.sector_label} · v{review.version}</span> : null}</>}
      status={<span className="tabular text-caos-2xs uppercase text-caos-accent">View: {roleView === "pm" ? "PM" : roleView === "qa" ? "QA" : "Analyst"} · composition only</span>}
      contextualControls={<>{headStat("Sector", review?.sector_label ?? context?.sector_id ?? "—")}{headStat("Versions", String(history.length))}{headStat("Approval", review?.authority.approval_state ?? "—")}</>}
      utilityLabel="Review utilities"
      utilityControls={<div className="space-y-4"><p className="text-caos-xs text-caos-muted">The global role control changes emphasis only. PM opens posture; QA opens sources and ratification health. Permissions are unchanged.</p><div><label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Compare version<select value={compareVersion} onChange={(event) => updateUrlState({ compare: event.target.value || null })} className="mt-2 block w-full rounded-sm border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-text focus-ring"><option value="">None</option>{history.filter((item) => item.id !== review?.id).map((item) => <option value={item.id} key={item.id}>v{item.version} · {fmtUtcDate(item.as_of)}</option>)}</select></label>{compare && review ? <p className="mt-2 text-caos-xs text-caos-muted">v{compare.version} {compare.posture} → v{review.version} {review.posture}. Source count {compare.source_register.length} → {review.source_register.length}.</p> : null}</div></div>}
      finalizationBar={<>{error ? <span className="mr-auto text-caos-xs text-caos-critical" role="alert">{error}</span> : <span className="mr-auto tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{review ? `${review.status} · ${review.missing_dependencies.length} dependency gaps` : "No draft"}</span>}{context ? <><Link href={contextHref("/sector-rv", context.id)} className="caos-action-secondary focus-ring no-underline">Open sector in RV</Link><Link href={contextHref("/query", context.id)} className="caos-action-secondary focus-ring no-underline">Investigate in Query</Link></> : null}{finalAction}</>}
      narrowContract={{ essentialControls: <span className="tabular text-caos-2xs uppercase text-caos-muted">{review?.sector_label ?? "Sector"}</span> }}
    >
      <main className="caos-persona-route sector-workbench min-h-0 flex-1 overflow-hidden p-2">
        <PersonaWorkbench
          surface="sector-review"
          decision={<DecisionHeader state={decisionState} defaultOpen />}
          context={<aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50" aria-label="Canonical sectors">
          <div className="border-b border-caos-border px-3 py-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Sectors</h2></div>
          <ul className="p-1.5">{taxonomy.map((sector) => { const subscribed = feeds.find((feed) => feed.sector === sector.label)?.enabled ?? true; const active = context?.sector_id === sector.id; return <li key={sector.id} className={`mb-1 rounded-sm border ${active ? "border-caos-accent bg-caos-info-surface" : "border-transparent"}`}><button type="button" onClick={() => void selectSector(sector.id)} className="w-full px-2 py-2 text-left focus-ring"><span className="flex items-center gap-2"><span className="text-caos-xs font-semibold text-caos-text">{sector.label}</span>{active && !review ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-caos-warning" aria-label="Review required" /> : null}</span><span className="mt-1 block tabular text-caos-2xs uppercase text-caos-muted">{active ? review?.status ?? "not reviewed" : "select"}</span></button><button type="button" role="switch" onClick={() => void toggleFeed(sector.label)} aria-checked={subscribed} className="mx-2 mb-2 flex min-h-6 items-center gap-1.5 rounded px-1.5 tabular text-caos-2xs uppercase tracking-wider text-caos-muted hover:text-caos-text transition-caos focus-ring"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${subscribed ? "bg-caos-success" : "bg-caos-idle"}`} />Alerts {subscribed ? "on" : "off"}</button></li>; })}</ul>
        </aside>}
          primary={<section className="min-h-0 h-full overflow-hidden flex flex-col border border-caos-border" aria-label="Sector dossier">
          <nav className="flex shrink-0 overflow-x-auto border-b border-caos-border bg-caos-panel/70 p-1" aria-label="Sector dossier sections"><select aria-label="Active sector" value={context?.sector_id ?? ""} onChange={(event) => void selectSector(event.target.value)} className="mr-1 min-w-36 rounded-sm border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring xl:hidden">{taxonomy.map((sector) => <option value={sector.id} key={sector.id}>{sector.label}</option>)}</select>{TABS.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => updateUrlState({ tab: item.id === (roleView === "qa" ? "sources" : "overview") ? null : item.id })} className={`min-h-8 whitespace-nowrap rounded-sm px-3 tabular text-caos-xs focus-ring ${tab === item.id ? "bg-caos-info-surface text-caos-text" : "text-caos-muted hover:text-caos-text"}`}>{item.label}</button>)}</nav>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!review ? <EmptyPanel text="No versioned dossier exists for this context. Request a refresh to create a draft without replacing any prior published review." /> : null}
            {review && tab === "overview" ? <div className="space-y-3"><section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{review.dimension_scores.map((score) => <article key={score.id} className="rounded-md border border-caos-border bg-caos-panel p-3"><div className="flex items-center gap-2"><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{score.label}</h3><span className="ml-auto tabular text-caos-sm font-semibold text-caos-text">{score.score ?? "—"}</span></div><p className="mt-2 text-caos-xs text-caos-warning">{score.missing_dependency ?? `${Math.round(score.confidence * 100)}% confidence`}</p></article>)}</section><section className="rounded-md border border-caos-border bg-caos-panel"><div className="border-b border-caos-border px-3 py-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Seven-section dossier</h2></div><ol>{review.sections.map((section) => <li key={section.id}><button type="button" onClick={() => { setSelectedSection(section.id); updateUrlState({ section: section.id }, "replace"); }} className={`grid w-full grid-cols-[1fr_auto] gap-3 border-t border-caos-border/70 px-3 py-3 text-left first:border-t-0 focus-ring ${selectedSection === section.id ? "bg-caos-info-surface" : "hover:bg-caos-elevated/30"}`}><span><span className="text-caos-sm font-semibold text-caos-text">{section.title}</span><span className="mt-1 block text-caos-xs leading-relaxed text-caos-muted">{section.summary}</span></span><span className="tabular text-caos-2xs uppercase text-caos-muted">{review.ratifications[section.id] ?? section.freshness}</span></button></li>)}</ol></section></div> : null}
            {review && tab === "signals" ? <div className="space-y-2">{review.early_warning.map((signal) => <article key={signal.id} className="rounded-md border border-caos-border bg-caos-panel p-3"><div className="flex items-center gap-2"><AnalysisStateBadge state={signal.status === "breached" ? "error" : signal.status === "watch" ? "partial" : "ready"} /><h3 className="text-caos-sm font-semibold text-caos-text">{signal.indicator}</h3></div><p className="mt-2 tabular text-caos-xs text-caos-muted">{signal.current_state} · threshold {signal.threshold}</p></article>)}</div> : null}
            {review && tab === "comparables" ? <DominantTableRegion ownerId="sector-comparables" label="Sector comparables" className="rounded-md border border-caos-border"><table className="w-full tabular text-caos-xs"><thead className="sticky top-0 bg-caos-panel text-caos-muted"><tr><th className="px-3 py-2 text-left">Issuer</th><th className="px-3 py-2 text-left">Posture</th><th className="px-3 py-2 text-left">Decision gaps</th></tr></thead><tbody>{review.comparables.map((item) => <tr key={item.issuer_id ?? item.issuer_name} className="border-t border-caos-border"><td className="px-3 py-2 font-semibold text-caos-text">{item.issuer_id ? <IssuerLink issuer={{ id: item.issuer_id }}>{item.issuer_name}</IssuerLink> : item.issuer_name}</td><td className="px-3 py-2 text-caos-muted">{item.posture}</td><td className="px-3 py-2 text-caos-warning">{item.missing_dependencies.join(" · ")}</td></tr>)}</tbody></table></DominantTableRegion> : null}
            {review && tab === "early-warning" ? <div className="space-y-2">{review.early_warning.map((item) => <article key={item.id} className="grid gap-2 rounded-md border border-caos-border bg-caos-panel p-3 md:grid-cols-[1fr_auto]"><div><h3 className="text-caos-sm font-semibold text-caos-text">{item.indicator}</h3><p className="mt-1 text-caos-xs text-caos-muted">Threshold · {item.threshold}</p></div><span className="tabular text-caos-xs uppercase text-caos-warning">{item.status} · {item.current_state}</span></article>)}</div> : null}
            {review && tab === "risks" ? <div className="space-y-2">{review.risks.map((risk) => <article key={risk.id} className="rounded-md border border-caos-border bg-caos-panel p-3"><div className="flex items-center gap-2"><span className="tabular text-caos-2xs uppercase text-caos-warning">{risk.severity}</span><h3 className="text-caos-sm font-semibold text-caos-text">{risk.title}</h3><span className="ml-auto tabular text-caos-2xs uppercase text-caos-muted">Likelihood {risk.likelihood}</span></div><p className="mt-2 text-caos-xs text-caos-muted">Residual risk · {risk.residual_risk}</p></article>)}</div> : null}
            {review && tab === "sources" ? <div className="space-y-3"><section className="rounded-md border border-caos-border bg-caos-panel"><div className="border-b border-caos-border px-3 py-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Source register</h2></div><ol>{review.source_register.map((source) => <li key={source.id} className="border-t border-caos-border/70 px-3 py-2 first:border-t-0"><div className="flex flex-wrap items-center gap-2"><span className="text-caos-xs font-semibold text-caos-text">{source.title}</span><span className="ml-auto tabular text-caos-2xs uppercase text-caos-muted">{source.origin} · {source.freshness}</span></div><p className="mt-1 tabular text-caos-2xs text-caos-muted">{source.id}</p></li>)}</ol></section><section className="rounded-md border border-caos-warning/50 bg-caos-warning/5 p-3"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-warning">Contradictions and uncertainty</h2><ol className="mt-2 space-y-2">{review.uncertainties.map((item) => <li key={item.id} className="text-caos-xs text-caos-text">△ {item.statement}<span className="block pl-4 text-caos-muted">{item.impact}</span></li>)}</ol>{context ? <Link href={contextHref("/monitor", context.id, { focus: "source-gaps" })} className="caos-action-secondary mt-3 focus-ring no-underline">Route gaps to QA</Link> : null}</section></div> : null}
          </div>
        </section>}
          inspector={<aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50 p-3" aria-label="Sector evidence inspector">
          <div className="flex items-center gap-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Evidence inspector</h2>{review ? <AnalysisStateBadge state={review.status} /> : null}</div>
          {review ? <><div className="mt-3"><AuthorityLine authority={review.authority} /></div>{selected ? <section className="mt-4"><h3 className="text-caos-sm font-semibold text-caos-text">{selected.title}</h3><p className="mt-2 text-caos-xs leading-relaxed text-caos-muted">{selected.summary}</p><p className="mt-2 tabular text-caos-2xs uppercase text-caos-muted">Confidence {Math.round(selected.confidence * 100)}% · {selected.signal_ids.length} signals</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void ratifySection(selected.id)} disabled={busy || review.ratifications[selected.id] === "ratified"} className="caos-action-secondary focus-ring disabled:opacity-40">{review.ratifications[selected.id] === "ratified" ? "Ratified" : "Ratify section"}</button>{context ? <Link href={contextHref("/query", context.id, { section: selected.id })} className="caos-action-secondary focus-ring no-underline">Open in Query</Link> : null}</div></section> : null}<section className="mt-4"><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Downstream readiness</h3><p className={`mt-1 text-caos-xs ${review.downstream_readiness.ready ? "text-caos-success" : "text-caos-warning"}`}>{review.downstream_readiness.ready ? "Ready" : `Blocked · ${review.downstream_readiness.blocked_by.join(" · ")}`}</p></section></> : <p className="mt-3 text-caos-xs text-caos-muted">Create or select a review version to inspect conclusion-level evidence.</p>}
          {context ? <div className="mt-4"><FindingsTray contextId={context.id} /></div> : null}
        </aside>}
        />
      </main>
    </EnterprisePage>
  );
}
