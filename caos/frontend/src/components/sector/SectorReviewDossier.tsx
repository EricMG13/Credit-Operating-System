"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { headStat } from "@/components/shared/headStat";
import { SECTOR_REVIEW_TABS, SectorReviewContent, type SectorReviewTab } from "./SectorReviewPanels";
import { getSectorFeeds, updateSectorFeeds, toErrorMessage, type SectorFeed } from "@/lib/api";
import {
  analysisApi,
  contextHref,
  useAnalysisContext,
  type AuthorityEnvelope,
  type SectorReviewV2,
} from "@/lib/analysis-workbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { authorityProvenance } from "@/lib/authority-decision";
import { useTypedUrlState } from "@/lib/typed-url-state";
import { fmtUtcDate, fmtUtcDateTime } from "@/lib/format-date";

const SECTOR_URL_KEYS = ["tab", "section", "compare"] as const;

function decisionAuthority(authority: AuthorityEnvelope): DecisionAuthority {
  return {
    provenance: authorityProvenance(authority),
    approval: ["ratified", "published"].includes(authority.approval_state) ? "RATIFIED" : authority.approval_state === "draft" ? "DRAFT" : "UNRATIFIED",
  };
}

function reviewDatum(review: SectorReviewV2 | null, value: React.ReactNode, fallback = "No versioned sector review in this context.", loading = false): DecisionDatumState {
  if (loading) return { kind: "loading", message: "Loading sector review…" };
  if (!review) return { kind: "unavailable", message: fallback };
  const authority = decisionAuthority(review.authority);
  const asOf = fmtUtcDateTime(review.as_of);
  if (review.status === "partial") return { kind: "partial", value, missingSources: review.missing_dependencies, asOf, authority };
  if (review.status === "stale") return { kind: "stale", value, asOf, authority };
  if (review.status === "error") return { kind: "error", message: "Sector review failed; the prior version remains available." };
  return { kind: "ready", value, asOf, authority };
}

type Setter<T> = Dispatch<SetStateAction<T>>;
type SectorContextState = ReturnType<typeof useAnalysisContext>;

interface SectorActionState {
  busy: boolean;
  contextState: SectorContextState;
  feeds: SectorFeed[];
  review: SectorReviewV2 | null;
  setBusy: Setter<boolean>;
  setError: Setter<string | null>;
  setFeeds: Setter<SectorFeed[]>;
  setHistory: Setter<SectorReviewV2[]>;
  setReview: Setter<SectorReviewV2 | null>;
  setSelectedSection: Setter<string | null>;
}

async function refreshSectorReview(state: SectorActionState) {
  const context = state.contextState.context;
  if (!context || state.busy) return;
  state.setBusy(true);
  state.setError(null);
  try {
    const next = await analysisApi.createSectorReview({ context_id: context.id, sector_id: context.sector_id ?? undefined, timeframe: "weekly" });
    state.setReview(next);
    state.setSelectedSection(next.sections[0]?.id ?? null);
    state.setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)]);
    state.contextState.setContext({ ...context, sector_review_run_id: next.id });
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Sector review refresh failed. The prior version is unchanged."));
  } finally {
    state.setBusy(false);
  }
}

async function ratifySectorSection(state: SectorActionState, sectionId: string) {
  if (!state.review || state.busy) return;
  state.setBusy(true);
  try {
    state.setReview(await analysisApi.ratifySectorReview(state.review.id, [{ section_id: sectionId, decision: "ratified" }]));
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Section ratification failed."));
  } finally {
    state.setBusy(false);
  }
}

async function ratifyEntireSectorReview(state: SectorActionState) {
  if (!state.review || state.busy) return;
  state.setBusy(true);
  const review = state.review;
  try {
    const decisions = review.sections.filter((section) => review.ratifications[section.id] !== "ratified").map((section) => ({ section_id: section.id, decision: "ratified" as const }));
    state.setReview(await analysisApi.ratifySectorReview(review.id, decisions));
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Review ratification failed."));
  } finally {
    state.setBusy(false);
  }
}

async function publishSectorReview(state: SectorActionState) {
  if (!state.review || state.busy) return;
  state.setBusy(true);
  try {
    state.setReview(await analysisApi.publishSectorReview(state.review.id));
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Publication gates are not satisfied."));
  } finally {
    state.setBusy(false);
  }
}

async function changeSector(state: SectorActionState, sectorId: string) {
  const context = state.contextState.context;
  if (!context || state.busy || sectorId === context.sector_id) return;
  state.setBusy(true);
  state.setError(null);
  try {
    const savedContext = await state.contextState.patch({
      sector_id: sectorId,
      sector_review_run_id: null,
      rv_run_id: null,
    });
    if (!savedContext) return;
    state.setReview(null);
    state.setHistory([]);
    state.setSelectedSection(null);
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Sector change could not be saved. The prior dossier remains active."));
  } finally {
    state.setBusy(false);
  }
}

async function toggleSectorFeed(state: SectorActionState, sectorLabel: string) {
  if (state.busy) return;
  const current = state.feeds.find((feed) => feed.sector === sectorLabel);
  const next = [...state.feeds.filter((feed) => feed.sector !== sectorLabel), {
    sector: sectorLabel, enabled: !(current?.enabled ?? true),
    notify_pref: current?.notify_pref ?? "in_app", provenance: current?.provenance ?? "profile",
  }];
  state.setBusy(true);
  state.setError(null);
  try {
    state.setFeeds(await updateSectorFeeds(next));
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Feed preference could not be saved."));
  } finally {
    state.setBusy(false);
  }
}

function useSectorReferenceData() {
  const [taxonomy, setTaxonomy] = useState<Array<{ id: string; label: string }>>([]);
  const [feeds, setFeeds] = useState<SectorFeed[]>([]);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  useEffect(() => {
    analysisApi.getTaxonomy().then((rows) => {
      setTaxonomy(rows);
      setTaxonomyError(null);
    }).catch(() => {
      setTaxonomy([]);
      setTaxonomyError("Sector taxonomy unavailable.");
    });
    getSectorFeeds().then((rows) => {
      setFeeds(rows);
      setFeedError(null);
    }).catch(() => {
      setFeeds([]);
      setFeedError("Sector feed preferences unavailable.");
    });
  }, []);
  return { feeds, setFeeds, taxonomy, referenceError: [taxonomyError, feedError].filter(Boolean).join(" ") || null };
}

function useSectorReviewHistory(contextState: SectorContextState, requestedSection: string | null | undefined) {
  const [history, setHistory] = useState<SectorReviewV2[]>([]);
  const [review, setReview] = useState<SectorReviewV2 | null>(null);
  // `review === null` is ambiguous — it means both "still fetching" and
  // "no versioned dossier exists" until the history fetch settles. Without
  // this the surface asserted an authoritative empty while the request was
  // still in flight, which could read as license to mint a duplicate draft.
  const [reviewLoading, setReviewLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contextId = contextState.context?.id ?? null;
  const activeSectorId = contextState.context?.sector_id ?? null;
  const requestedReviewId = contextState.context?.sector_review_run_id ?? null;
  useEffect(() => {
    if (!contextId) {
      setHistory([]);
      setReview(null);
      setReviewLoading(contextState.loading);
      return;
    }
    let cancelled = false;
    setReviewLoading(true);
    setError(null);
    setHistory([]);
    setReview(null);
    analysisApi.listSectorReviews(contextId).then((rows) => {
      if (cancelled) return;
      const sectorRows = activeSectorId
        ? rows.filter((item) => item.sector_id === activeSectorId)
        : rows;
      const active = sectorRows.find((item) => item.id === requestedReviewId) ?? sectorRows[0] ?? null;
      setHistory(sectorRows);
      setReview(active);
    }).catch((reason) => {
      if (!cancelled) setError(toErrorMessage(reason, "Sector review history unavailable."));
    }).finally(() => {
      if (!cancelled) setReviewLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSectorId, contextId, contextState.loading, requestedReviewId]);
  useEffect(() => {
    setSelectedSection(requestedSection ?? review?.sections[0]?.id ?? null);
  }, [requestedSection, review]);
  return { error, history, review, reviewLoading, selectedSection, setError, setHistory, setReview, setSelectedSection };
}

function useSectorReviewController() {
  const { roleView } = useRoleView();
  const contextState = useAnalysisContext({ name: "Telecom sector dossier", sector_id: "telecom" });
  const { values: urlState, update: updateUrlState } = useTypedUrlState(SECTOR_URL_KEYS);
  const reference = useSectorReferenceData();
  const reviews = useSectorReviewHistory(contextState, urlState.section);
  const tab: SectorReviewTab = SECTOR_REVIEW_TABS.some((item) => item.id === urlState.tab) ? urlState.tab as SectorReviewTab : roleView === "qa" ? "sources" : "overview";
  const compareVersion = urlState.compare ?? "";
  const [busy, setBusy] = useState(false);
  const [ratifyAllArmed, setRatifyAllArmed] = useState(false);

  const actionState: SectorActionState = {
    busy, contextState, feeds: reference.feeds, review: reviews.review, setBusy,
    setError: reviews.setError, setFeeds: reference.setFeeds, setHistory: reviews.setHistory,
    setReview: reviews.setReview, setSelectedSection: reviews.setSelectedSection,
  };
  const requestRefresh = () => refreshSectorReview(actionState);
  const ratifySection = (sectionId: string) => ratifySectorSection(actionState, sectionId);
  const ratifyAll = () => ratifyEntireSectorReview(actionState);
  const publish = () => publishSectorReview(actionState);
  const selectSector = (sectorId: string) => changeSector(actionState, sectorId);
  const toggleFeed = (sectorLabel: string) => toggleSectorFeed(actionState, sectorLabel);

  const selected = reviews.review?.sections.find((section) => section.id === reviews.selectedSection) ?? reviews.review?.sections[0] ?? null;
  const compare = reviews.history.find((item) => item.id === compareVersion) ?? null;
  const ratifiableSections = reviews.review?.sections.filter((section) => reviews.review?.ratifications[section.id] !== "ratified") ?? [];
  const ratificationScope = ratifiableSections.map((section) => section.title).join(" · ");
  const error = contextState.error ?? contextState.mutationError ?? reviews.error ?? reference.referenceError;
  useEffect(() => { setRatifyAllArmed(false); }, [reviews.review?.id, ratificationScope]);
  return {
    busy, compare, compareVersion, contextState, ...reference, ...reviews, error, publish, ratifiableSections,
    ratificationScope, ratifyAll, ratifyAllArmed, ratifySection, requestRefresh,
    roleView, selectSector, selected, setRatifyAllArmed, tab,
    toggleFeed, updateUrlState,
  };
}

type SectorController = ReturnType<typeof useSectorReviewController>;

function sectorDecisionState(controller: SectorController): DecisionContextState {
  const review = controller.review;
  return {
    whatChanged: reviewDatum(review, review?.what_changed, "No change observation — no versioned review in this context.", controller.reviewLoading),
    whyItMatters: reviewDatum(review, review?.why_it_matters, "No impact assessment yet — run a review to establish one.", controller.reviewLoading),
    requiredAction: reviewDatum(review, review?.required_action, "No required action — no review to act on.", controller.reviewLoading),
    evidenceHealth: reviewDatum(review, review?.evidence_health, "No evidence register — no review has been run.", controller.reviewLoading),
  };
}

type SectorFinalActionKind = "refresh" | "publish" | "confirm" | "arm" | "none";

function sectorFinalActionKind(controller: SectorController): SectorFinalActionKind {
  if (!controller.review || ["partial", "stale"].includes(controller.review.status)) return "refresh";
  if (controller.review.authority.approval_state === "published") return "none";
  if (controller.review.authority.approval_state === "ratified") return "publish";
  return controller.ratifyAllArmed ? "confirm" : "arm";
}

function SectorPublishAction({ controller }: { controller: SectorController }) {
  return <button type="button" data-page-primary-action onClick={() => void controller.publish()} disabled={controller.busy} className="caos-action-primary focus-ring disabled:opacity-40">Publish review</button>;
}

function SectorConfirmAction({ controller }: { controller: SectorController }) {
  const count = controller.ratifiableSections.length;
  const suffix = count === 1 ? "" : "s";
  return <button type="button" data-page-primary-action onClick={() => void controller.ratifyAll()} disabled={controller.busy || count === 0} className="caos-action-primary focus-ring disabled:opacity-40">Confirm ratify {count} section{suffix}</button>;
}

function SectorArmAction({ controller }: { controller: SectorController }) {
  const disabled = controller.busy || controller.ratifiableSections.length === 0;
  return <button type="button" data-page-primary-action onClick={() => controller.setRatifyAllArmed(true)} disabled={disabled} className="caos-action-primary focus-ring disabled:opacity-40">Ratify updates</button>;
}

function SectorFinalAction({ controller }: { controller: SectorController }) {
  const kind = sectorFinalActionKind(controller);
  if (kind === "refresh" || kind === "none") return null;
  if (kind === "publish") return <SectorPublishAction controller={controller} />;
  if (kind === "confirm") return <SectorConfirmAction controller={controller} />;
  return <SectorArmAction controller={controller} />;
}

function SectorUtilities({ controller }: { controller: SectorController }) {
  const { compare, compareVersion, history, review, updateUrlState } = controller;
  return <div className="space-y-4">
    <p className="text-caos-xs text-caos-muted">The global role control changes emphasis only. PM opens posture; QA opens sources and ratification health. Permissions are unchanged.</p>
    <div>
      <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Compare version
        <select value={compareVersion} onChange={(event) => updateUrlState({ compare: event.target.value || null })} className="mt-2 block w-full rounded-sm border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-text focus-ring">
          <option value="">None</option>
          {history.filter((item) => item.id !== review?.id).map((item) => <option value={item.id} key={item.id}>v{item.version} · {fmtUtcDate(item.as_of)}</option>)}
        </select>
      </label>
      {compare && review ? <p className="mt-2 text-caos-xs text-caos-muted">v{compare.version} {compare.posture} → v{review.version} {review.posture}. Source count {compare.source_register.length} → {review.source_register.length}.</p> : null}
    </div>
  </div>;
}

function SectorFinalization({ controller }: { controller: SectorController }) {
  const { contextState, error, ratificationScope, ratifyAllArmed, review } = controller;
  const context = contextState.context;
  const status = review ? `${review.status} · ${review.missing_dependencies.length} dependency gaps` : "No draft";
  const visibleError = error && /^Request failed with status code \d+$/i.test(error)
    ? "Sector review service unavailable. The prior dossier remains unchanged."
    : error;
  return <>
    {visibleError ? <span className="mr-auto text-caos-xs text-caos-critical" role="alert">{visibleError}</span>
      : ratifyAllArmed ? <span className="mr-auto text-caos-xs text-caos-warning">Confirm ratification scope · {ratificationScope}</span>
        : <span className="mr-auto tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{status}</span>}
    {context ? <>
      <Link href={contextHref("/sector-rv", context.id)} className="caos-action-secondary focus-ring no-underline">Open sector in RV</Link>
      <Link href={contextHref("/query", context.id)} className="caos-action-secondary focus-ring no-underline">Investigate in Query</Link>
    </> : null}
    <SectorFinalAction controller={controller} />
  </>;
}

type SectorTaxonomyItem = SectorController["taxonomy"][number];

function sectorDirectoryRowClass(active: boolean) {
  return `mb-1 rounded-sm border ${active ? "border-caos-accent bg-caos-info-surface" : "border-transparent"}`;
}

function SectorReviewRequired({ active, review }: { active: boolean; review: SectorReviewV2 | null }) {
  return active && !review ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-caos-warning" aria-label="Review required" /> : null;
}

function SectorActiveState({ active, review }: { active: boolean; review: SectorReviewV2 | null }) {
  return active ? <span className="mt-1 block tabular text-caos-2xs uppercase text-caos-muted">{review?.status ?? "not reviewed"}</span> : null;
}

function SectorFeedSignal({ subscribed }: { subscribed: boolean }) {
  return subscribed ? null : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-caos-warning" />;
}

function sectorFeedClass(subscribed: boolean) {
  const signal = subscribed ? "text-caos-muted hover:text-caos-text" : "text-caos-warning";
  return `mx-2 mb-2 flex min-h-6 items-center gap-1.5 rounded px-1.5 tabular text-caos-2xs uppercase tracking-wider transition-caos focus-ring ${signal}`;
}

function SectorDirectoryRow({ controller, sector }: { controller: SectorController; sector: SectorTaxonomyItem }) {
  const { busy, contextState, feeds, review } = controller;
  const subscribed = feeds.find((feed) => feed.sector === sector.label)?.enabled ?? true;
  const active = contextState.context?.sector_id === sector.id;
  return <li className={sectorDirectoryRowClass(active)}>
    <button type="button" onClick={() => void controller.selectSector(sector.id)} disabled={busy} className="w-full px-2 py-2 text-left focus-ring disabled:opacity-40">
      <span className="flex items-center gap-2">
        <span className="text-caos-xs font-semibold text-caos-text">{sector.label}</span>
        <SectorReviewRequired active={active} review={review} />
      </span>
      <SectorActiveState active={active} review={review} />
    </button>
    <button type="button" role="switch" onClick={() => void controller.toggleFeed(sector.label)} aria-checked={subscribed} disabled={busy} className={`${sectorFeedClass(subscribed)} disabled:opacity-40`}>
      <SectorFeedSignal subscribed={subscribed} />Alert coverage · {subscribed ? "active" : "inactive"}
    </button>
  </li>;
}

function SectorDirectory({ controller }: { controller: SectorController }) {
  return <aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50" aria-label="Canonical sectors">
    <div className="border-b border-caos-border px-3 py-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Sectors</h2></div>
    <ul className="p-1.5">{controller.taxonomy.map((sector) => <SectorDirectoryRow key={sector.id} controller={controller} sector={sector} />)}</ul>
  </aside>;
}

function SectorDossierTabs({ controller }: { controller: SectorController }) {
  const { contextState, roleView, tab, taxonomy, updateUrlState } = controller;
  const defaultTab = roleView === "qa" ? "sources" : "overview";
  const directTabs = SECTOR_REVIEW_TABS.filter((item) => !["early-warning", "sources"].includes(item.id));
  const secondaryTabs = SECTOR_REVIEW_TABS.filter((item) => ["early-warning", "sources"].includes(item.id));
  const tabButton = (item: (typeof SECTOR_REVIEW_TABS)[number]) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => updateUrlState({ tab: item.id === defaultTab ? null : item.id })} className={`min-h-8 whitespace-nowrap rounded-sm px-3 tabular text-caos-xs focus-ring ${tab === item.id ? "bg-caos-info-surface text-caos-text" : "text-caos-muted hover:text-caos-text"}`}>{item.label}</button>;
  return <nav className="flex shrink-0 overflow-visible border-b border-caos-border bg-caos-panel/70 p-1" aria-label="Sector dossier sections">
    <div data-sector-tabs-scroll className="flex min-w-0 flex-1 overflow-x-auto">
      <select aria-label="Active sector" value={contextState.context?.sector_id ?? ""} onChange={(event) => void controller.selectSector(event.target.value)} disabled={controller.busy} className="mr-1 min-w-36 rounded-sm border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring disabled:opacity-40 xl:hidden">
        {taxonomy.map((sector) => <option value={sector.id} key={sector.id}>{sector.label}</option>)}
      </select>
      {directTabs.map(tabButton)}
    </div>
    {secondaryTabs.length ? <details className="relative shrink-0">
      <summary className="flex min-h-8 cursor-pointer list-none items-center rounded-sm px-3 tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring">More</summary>
      <div data-sector-more-menu className="absolute right-0 z-20 mt-1 grid min-w-36 rounded border border-caos-border bg-caos-elevated p-1 shadow-xl">
        {secondaryTabs.map(tabButton)}
      </div>
    </details> : null}
  </nav>;
}

function SectorDossier({ controller }: { controller: SectorController }) {
  const selectSection = (sectionId: string) => {
    controller.setSelectedSection(sectionId);
    controller.updateUrlState({ section: sectionId }, "replace");
  };
  return <section className="min-h-0 h-full overflow-hidden flex flex-col border border-caos-border" aria-label="Sector dossier">
    <SectorDossierTabs controller={controller} />
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <SectorReviewContent
        review={controller.review}
        tab={controller.tab}
        loading={controller.reviewLoading}
        selectedSection={controller.selectedSection}
        contextId={controller.contextState.context?.id}
        onSelectSection={selectSection}
      />
    </div>
  </section>;
}

function SelectedSectorSection({ controller }: { controller: SectorController }) {
  const { busy, contextState, review, selected } = controller;
  if (!review || !selected) return null;
  const ratified = review.ratifications[selected.id] === "ratified";
  return <section className="mt-4">
    <h3 className="text-caos-sm font-semibold text-caos-text">{selected.title}</h3>
    <p className="mt-2 text-caos-xs leading-relaxed text-caos-muted">{selected.summary}</p>
    <p className="mt-2 tabular text-caos-2xs uppercase text-caos-muted">Confidence {Math.round(selected.confidence * 100)}% · {selected.signal_ids.length} signals</p>
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={() => void controller.ratifySection(selected.id)} disabled={busy || ratified} className="caos-action-secondary focus-ring disabled:opacity-40">{ratified ? "Ratified" : "Ratify section"}</button>
      {contextState.context ? <Link href={contextHref("/query", contextState.context.id, { section: selected.id })} className="caos-action-secondary focus-ring no-underline">Open in Query</Link> : null}
    </div>
  </section>;
}

function SectorDownstreamReadiness({ review }: { review: SectorReviewV2 }) {
  return <section className="mt-4">
    <h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Downstream readiness</h3>
    <p className={`mt-1 text-caos-xs ${review.downstream_readiness.ready ? "text-caos-success" : "text-caos-warning"}`}>{review.downstream_readiness.ready ? "Ready" : `Blocked · ${review.downstream_readiness.blocked_by.join(" · ")}`}</p>
  </section>;
}

function SectorInspector({ controller }: { controller: SectorController }) {
  const { contextState, review } = controller;
  return <aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50 p-3" aria-label="Sector evidence inspector">
    <div className="flex items-center gap-2">
      <h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Evidence inspector</h2>
      {review ? <AnalysisStateBadge state={review.status} /> : null}
    </div>
    {review ? <><div className="mt-3"><AuthorityLine authority={review.authority} /></div><SelectedSectorSection controller={controller} /><SectorDownstreamReadiness review={review} /></>
      : <p className="mt-3 text-caos-xs text-caos-muted">Create or select a review version to inspect conclusion-level evidence.</p>}
    {contextState.context ? <div className="mt-4"><FindingsTray contextId={contextState.context.id} /></div> : null}
  </aside>;
}

function SectorIdentity({ review }: { review: SectorReviewV2 | null }) {
  return <><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text">Sector Review</span>{review ? <span className="tabular text-caos-2xs text-caos-muted">{review.sector_label} · v{review.version}</span> : null}</>;
}

function SectorContextStats({ controller }: { controller: SectorController }) {
  const { contextState, history, review } = controller;
  return <>
    {headStat("Sector", review?.sector_label ?? contextState.context?.sector_id ?? "—")}
    {headStat("Posture", review?.posture ?? "—")}
    {headStat("Versions", String(history.length))}
    {headStat("Approval", review?.authority.approval_state ?? "—")}
  </>;
}

function SectorNarrowControl({ review }: { review: SectorReviewV2 | null }) {
  return <span className="tabular text-caos-2xs uppercase text-caos-muted">{review?.sector_label ?? "Sector"}</span>;
}

function SectorReviewPage({ controller }: { controller: SectorController }) {
  const { review } = controller;
  return <EnterprisePage
    kind="analytical"
    identity={<SectorIdentity review={review} />}
    primaryAction={{
      label: "Request refresh",
      onAction: () => { void controller.requestRefresh(); },
      unavailableReason: !controller.contextState.context
        ? "Select or create an analysis context first"
        : controller.busy
          ? "A sector review action is already in progress"
          : null,
    }}
    status={<span className="tabular text-caos-2xs uppercase text-caos-accent">Shared governed workspace</span>}
    contextualControls={<SectorContextStats controller={controller} />}
    utilityLabel="Review utilities"
    utilityControls={<SectorUtilities controller={controller} />}
    finalizationBar={<SectorFinalization controller={controller} />}
    narrowContract={{ essentialControls: <SectorNarrowControl review={review} /> }}
  >
    <section aria-label="Sector review workspace" className="caos-persona-route sector-workbench min-h-0 flex-1 overflow-hidden p-2">
      <PersonaWorkbench
        surface="sector-review"
        decision={<DecisionHeader state={sectorDecisionState(controller)} defaultOpen />}
        context={review ? <SectorDirectory controller={controller} /> : null}
        primary={<SectorDossier controller={controller} />}
        inspector={review ? <SectorInspector controller={controller} /> : null}
      />
    </section>
  </EnterprisePage>;
}

export function SectorReviewDossier() {
  return <SectorReviewPage controller={useSectorReviewController()} />;
}
