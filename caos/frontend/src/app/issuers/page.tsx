"use client";

// Issuer Register — the workspace hub, in the CAOS design language shared by
// the five concept sections: h-10 sub-header, dense tabular rows, panel chrome.

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { CloseButton } from "@/components/shared/CloseButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getIssuers, createIssuer, toErrorMessage } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { TextInput } from "@/components/shared/TextInput";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { COUNTRIES, issuerProfileHref, issuerRating, issuerSector, ratingDistressed } from "@/lib/issuers";
import { DEMO_UNIVERSE } from "@/lib/issuer-demo";
import { FilterHeader, updateColumnFilter, useColumnFilters, type FilterState, type SortState } from "@/components/shared/TableColumnFilter";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { BatchBar } from "@/components/shared/BatchBar";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { addToWatchlistAction, exportCsvAction, runPipelineAction } from "@/components/issuers/batchActions";
import { contextHref, useAnalysisContext, type AnalysisSurfaceStateEntry } from "@/lib/analysis-workbench";
import { useRovingFocus } from "@/lib/useRovingFocus";
import { syncRowActionTabStops } from "@/lib/rowActionMode";
import { handleRovingActionRowKeyDown } from "@/lib/row-action-keyboard";

export default function IssuersPage() {
  return (
    <RequireAuth>
      <IssuersDirectory />
    </RequireAuth>
  );
}


// Ratings are no longer typed here — collected from ingested structured sheets
// (see server ratings.py / ingestion._collect_ratings) and still shown read-only
// in the directory + profile from the issuer record.
const EMPTY_FORM = { name: "", ticker: "", sector: "", sub_sector: "", country: "", figi: "", sponsor: "" };
const COLS = "grid grid-cols-[28px_76px_minmax(200px,1.6fr)_78px_minmax(96px,1fr)_minmax(120px,1fr)_104px_84px] items-center gap-x-3";
const FILTER_KEYS = ["ticker", "name", "rating", "sector", "sub_sector", "country"] as const;
const SORTABLE = new Set<string>(["ticker", "name", "rating", "sector", "sub_sector", "country"]);
// fallow-ignore-next-line complexity -- Dense directory filters, batching, pagination, and context state share one route boundary.
function IssuersDirectory() {
  const analysis = useAnalysisContext({ name: "Coverage universe" });
  const router = useRouter();
  const { openProfile } = useIssuerProfileOverlay();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  // True only when the registry fetch *failed* (network/500) — distinct from an
  // empty registry. We still show the demo universe so the page isn't a dead end,
  // but a banner makes the degraded state explicit rather than passing fabricated
  // issuers off as real coverage (trust-through-transparency). See QA BUG-002.
  const [degraded, setDegraded] = useState(false);
  // True when the registry is reachable but *empty*, so the rows on screen are
  // the DEMO_UNIVERSE sample rather than real coverage. Distinct from `degraded`
  // (fetch failure): a neutral, non-alarming signal that invites starting real
  // coverage rather than warning of a broken fetch. See QA BUG-002.
  const [demo, setDemo] = useState(false);
  // Latches once a real (non-demo, non-empty) registry response lands this
  // session. Used by the fetch-failure path to decide whether it may fall back
  // to the demo universe (only when no real coverage was ever loaded) rather
  // than swapping the analyst's actual book for fabricated rows. A ref, not
  // state, so the effect's catch reads the live value without re-subscribing.
  const hadRealCoverage = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<FilterState>({});
  // Column sort. Default: issuer name ascending, so a 60+ name register lands
  // in a scannable order (H7). Clicking a sortable header cycles asc→desc→none;
  // `null` (cleared) reverts to the raw server/demo order.
  const [sort, setSort] = useState<SortState>({ col: "name", dir: "asc" });
  // BatchBar selection (WP-10). Pruned against `issuers` below so a stale id
  // never survives a reload/search that drops that row from the register.
  const [selected, setSelected] = useState<string[]>([]);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const hydratedContext = useRef<string | null>(null);

  // Server-side search across name / ticker / industry / country / FIGI,
  // debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    let stale = false;
    // Empty registry OR a failed fetch → fall back to the demo universe, filtered
    // client-side so search still works against it.
    const demoFiltered = () => {
      const q = query.trim().toLowerCase();
      return q
        ? DEMO_UNIVERSE.filter((i) =>
            `${i.name} ${i.ticker ?? ""} ${issuerSector(i)} ${i.sub_sector ?? ""}`.toLowerCase().includes(q)
          )
        : DEMO_UNIVERSE;
    };
    const t = setTimeout(() => {
      getIssuers(query)
        .then((rows) => {
          if (stale) return;
          setDegraded(false);
          const empty = rows.length === 0;
          setDemo(empty);
          if (!empty) hadRealCoverage.current = true;
          setIssuers(empty ? demoFiltered() : rows);
        })
        // Network/500 → degrade, but NEVER swap real coverage for fabricated
        // sample rows: if we already have real issuers loaded this session, keep
        // them on screen (the banner explains it's a stale/last-loaded view).
        // Only fall back to the demo universe when no real coverage was ever
        // fetched — otherwise the register would show demo names where the
        // analyst's actual book just was (worst failure shape; QA BUG-002).
        .catch(() => {
          if (stale) return;
          setDegraded(true);
          setDemo(false);
          // Retain the last real rows if we ever had them; only fabricate demo
          // coverage when nothing real was ever loaded this session.
          setIssuers((prev) => (hadRealCoverage.current && prev.length > 0 ? prev : demoFiltered()));
        })
        .finally(() => { if (!stale) setLoading(false); });
    }, query ? 200 : 0);
    return () => { stale = true; clearTimeout(t); };
  }, [query, reloadKey]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  // Restore and persist only the validated directory state. Legacy context
  // `filters`/`selected` remain readable server-side, but this route writes the
  // discriminated `issuers` surface contract from now on.
  const issuerContext = analysis.context;
  const patchIssuerContext = analysis.patch;
  useEffect(() => {
    const context = issuerContext;
    if (!context || hydratedContext.current === context.id) return;
    hydratedContext.current = context.id;
    const saved = context.surface_state.issuers;
    if (!new URLSearchParams(window.location.search).get("q") && saved?.query) setQuery(saved.query);
    if (saved?.selected_ids) setSelected(saved.selected_ids);
    if (saved?.filters) setFilters(saved.filters as FilterState);
    if (saved?.sort) {
      const [col, dir] = saved.sort.split(":");
      if (SORTABLE.has(col) && (dir === "asc" || dir === "desc")) setSort({ col, dir });
    }
  }, [issuerContext]);

  useEffect(() => {
    const context = issuerContext;
    if (!context || hydratedContext.current !== context.id) return;
    const issuerIds = Array.from(new Set([...context.issuer_ids, ...selected]));
    const persistedFilters = Object.fromEntries(
      Object.entries(filters).filter((entry): entry is [string, string[]] => Array.isArray(entry[1])),
    ) as NonNullable<AnalysisSurfaceStateEntry["filters"]>;
    const nextSurface = {
      query: query || null,
      selected_ids: selected,
      sort: sort ? `${sort.col}:${sort.dir}` : null,
      view: "directory",
      filters: persistedFilters,
    };
    // Field-by-field guard, never a whole-object JSON.stringify: the server
    // echoes the slice with its own key order and normalization, so a
    // stringify comparison failed on every response and re-armed the 250ms
    // patch forever — a write storm that burned the 45/min budget from merely
    // sitting on the Directory (rev 88 on a minute-old workspace).
    const saved = context.surface_state.issuers ?? {};
    const sortedFilters = (value: object) => JSON.stringify(Object.entries(value).sort((a, b) => a[0].localeCompare(b[0])));
    if (
      issuerIds.length === context.issuer_ids.length
      && issuerIds.every((id, index) => id === context.issuer_ids[index])
      && (saved.query ?? null) === nextSurface.query
      && JSON.stringify(saved.selected_ids ?? []) === JSON.stringify(nextSurface.selected_ids)
      && (saved.sort ?? null) === nextSurface.sort
      && (saved.view ?? null) === nextSurface.view
      && sortedFilters(saved.filters ?? {}) === sortedFilters(nextSurface.filters)
    ) return;
    const timer = window.setTimeout(() => {
      void patchIssuerContext({
        issuer_ids: issuerIds,
        surface_state: {
          ...context.surface_state,
          // Merge over the saved slice — replacing it wholesale stripped keys
          // this effect doesn't own (openIssuer's active_id), which set up a
          // second write ping-pong.
          issuers: { ...saved, ...nextSurface },
        },
      }).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters, issuerContext, patchIssuerContext, query, selected, sort]);

  const openIssuer = (issuerId: string) => {
    // Navigation is never hostage to the context write: the profile opens
    // immediately, the patch reconciles in the background, and a rejection
    // (e.g. the 45/min analysis-write limit) surfaces through the mounted
    // AnalysisContextSaveState instead of silently eating the click.
    openProfile(issuerId);
    const context = analysis.context;
    if (context) {
      void analysis.patch({
        issuer_ids: context.issuer_ids.includes(issuerId) ? context.issuer_ids : [...context.issuer_ids, issuerId],
        surface_state: {
          ...context.surface_state,
          issuers: { ...(context.surface_state.issuers ?? {}), active_id: issuerId, selected_ids: selected },
        },
      }).catch(() => undefined);
    }
  };

  // Drop any selected id that's no longer in the register (search/reload
  // swapped the row set out from under it) — a batch action must never run
  // against an issuer that isn't there to run it against.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => issuers.some((i) => i.id === id)));
  }, [issuers]);

  const filterVals = useMemo<Record<(typeof FILTER_KEYS)[number], (issuer: Issuer) => string | number | null | undefined>>(() => ({
    ticker: (i) => i.ticker?.slice(0, 5).toUpperCase() || "—",
    name: (i) => i.name,
    rating: (i) => issuerRating(i) || "—",
    sector: (i) => issuerSector(i) || "—",
    sub_sector: (i) => i.sub_sector || "—",
    country: (i) => i.country || "—",
  }), []);
  const filteredIssuers = useColumnFilters(issuers, filters, filterVals);

  // Apply the active column sort after filtering. Comparison reuses the same
  // per-column accessors as filtering (filterVals), so what you sort by is
  // exactly what the row shows. Placeholder "—" cells sink to the bottom on
  // asc and rise last on desc rather than colliding with real values. A stable
  // tie-break on issuer name keeps equal keys in a deterministic order.
  const shownIssuers = useMemo(() => {
    if (!sort || !SORTABLE.has(sort.col)) return filteredIssuers;
    const get = filterVals[sort.col as keyof typeof filterVals];
    const factor = sort.dir === "asc" ? 1 : -1;
    const norm = (v: string | number | null | undefined) => {
      if (v == null) return "";
      const s = String(v).trim();
      return s === "—" ? "" : s;
    };
    const cmp = (a: Issuer, b: Issuer) => {
      const av = norm(get(a));
      const bv = norm(get(b));
      // Empty/placeholder always sorts last, regardless of direction.
      if (av === "" && bv === "") return 0;
      if (av === "") return 1;
      if (bv === "") return -1;
      const primary = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * factor;
      if (primary !== 0) return primary;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    };
    return [...filteredIssuers].sort(cmp);
  }, [filteredIssuers, sort, filterVals]);
  const cycleSort = (col: string) =>
    setSort((s) =>
      s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null
    );
  const ratedCount = useMemo(() => issuers.filter((i) => issuerRating(i)).length, [issuers]);
  const setFilter = (col: string, values: string[] | undefined) =>
    setFilters((filters) => updateColumnFilter(filters, col, values));

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Select-all applies to the currently visible (filtered+sorted) rows only —
  // toggling it never touches a selection made outside the current view.
  const shownIds = shownIssuers.map((i) => i.id);
  const { getItemProps: getIssuerRowFocusProps } = useRovingFocus(shownIds);

  useEffect(() => {
    if (actionRowId && !shownIds.includes(actionRowId)) setActionRowId(null);
    for (const [id, row] of rowRefs.current) syncRowActionTabStops(row, actionRowId === id);
  }, [actionRowId, shownIds]);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.includes(id));
  const toggleSelectAllShown = () =>
    setSelected((prev) =>
      allShownSelected ? prev.filter((id) => !shownIds.includes(id)) : Array.from(new Set([...prev, ...shownIds]))
    );

  // Exactly three real actions — Run pipeline, Add to watchlist, Export CSV.
  // No delete/refresh/assign: none of those have real backing semantics yet,
  // and BatchBar's contract is to never claim a fake blanket "done".
  const batchActions = [
    runPipelineAction(selected.length),
    addToWatchlistAction(selected),
    exportCsvAction(issuers.filter((i) => selected.includes(i.id))),
  ];

  const summaryLabel = loading
    ? "loading…"
    : query
    ? issuers.length + (issuers.length === 1 ? " match" : " matches") + " for “" + query + "”"
    : demo
    ? DEMO_UNIVERSE.length + " sample issuers"
    // No universe/sleeve descriptor is computed anywhere — the register mixes
    // US, UK, and French issuers, so a hardcoded "US HY sleeve" suffix was a
    // false claim about the actual coverage. State only what's counted.
    : issuers.length + " issuers" + (ratedCount ? " · " + ratedCount + " rated" : "");

  const narrowContract: NarrowContract = {
    essentialControls: (
      <>
        <ConceptNav compact />
        <span className="h-4 w-px bg-caos-border shrink-0" />
        <Link
          href={analysis.context ? contextHref("/sponsors", analysis.context.id) : "/sponsors"}
          className="no-underline tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
        >
          SPONSORS
        </Link>
        <Link
          href={analysis.context ? contextHref("/upload", analysis.context.id) : "/upload"}
          className="no-underline tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
        >
          UPLOAD
        </Link>
      </>
    ),
  };

  return (
    <EnterprisePage kind="worklist"
      identity={
        <ShellIdentity
          badges={!loading && demo ? (
            <span
              className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
              style={{ borderColor: "var(--caos-border)", color: "var(--caos-muted)" }}
              title="No live coverage yet — these are sample issuers, not real coverage"
            >
              Demo coverage
            </span>
          ) : null}
          title="Issuer register"
        >
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap truncate min-w-0 hidden xl:inline">{summaryLabel}</span>
        </ShellIdentity>
      }
      primaryAction={
        <button
          onClick={() => setShowForm(true)}
          className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap focus-ring"
        >
          + NEW ISSUER
        </button>
      }
      status={<AnalysisContextSaveState analysis={analysis} />}
      contextualControls={
        <Link
          href={analysis.context ? contextHref("/upload", analysis.context.id) : "/upload"}
          className="caos-secondary-action no-underline focus-ring"
        >
          Upload documents
        </Link>
      }
      utilityLabel="Directory utilities"
      utilityControls={
        <Link
          href={analysis.context ? contextHref("/sponsors", analysis.context.id) : "/sponsors"}
          className="caos-secondary-action no-underline focus-ring w-full justify-start"
        >
          Open Sponsors
        </Link>
      }
      narrowContract={narrowContract}
    >
      <div className="caos-persona-route issuers-workbench flex-1 min-h-0 p-2">
      <PersonaWorkbench surface="issuers" primary={<div className="h-full min-h-0 flex flex-col">
      <WorkbenchToolbar
        title="Coverage register"
        description="Filter, select and route covered names without losing issuer context."
        count={summaryLabel}
        viewLabel="Shared worklist"
      />
      {/* degraded banner — registry fetch failed; demo coverage shown is NOT live */}
      {degraded ? (
        <div
          role="alert"
          className="shrink-0 mx-2 mt-2 flex items-center gap-2 px-3 py-1.5 rounded border tabular text-caos-sm"
          style={{ borderColor: "var(--caos-warning)", background: "color-mix(in srgb, var(--caos-warning) 12%, transparent)", color: "var(--caos-text)" }}
        >
          <StatusGlyph kind="warning" />
          {hadRealCoverage.current ? (
            <span>Couldn&rsquo;t reach the registry — showing <span className="font-medium" style={{ color: "var(--caos-warning)" }}>the last loaded results</span>, which may be out of date.</span>
          ) : (
            <span>Couldn&rsquo;t reach the registry — showing <span className="font-medium" style={{ color: "var(--caos-warning)" }}>demo coverage</span>, not live data.</span>
          )}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="ml-1 tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
          >
            RETRY
          </button>
        </div>
      ) : null}

      {/* demo banner — registry is reachable but empty; the rows below are a
          sample sleeve, not real coverage. Neutral (not warning): an invitation
          to start coverage, styled apart from the amber fetch-failure banner. */}
      {!loading && demo && !degraded ? (
        <div
          className="shrink-0 mx-2 mt-2 flex items-center gap-2 px-3 py-1.5 rounded border border-caos-border bg-caos-elevated/40 tabular text-caos-sm text-caos-muted"
        >
          <StatusGlyph kind="idle" className="text-caos-muted" />
          <span>
            No live coverage yet — showing a <span className="text-caos-text">sample sleeve</span> so you can explore the workspace.
          </span>
          <button
            onClick={() => setShowForm(true)}
            className="ml-1 tabular text-caos-xs px-2 py-0.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring whitespace-nowrap"
          >
            + NEW ISSUER
          </button>
        </div>
      ) : null}

      {/* directory */}
      <DominantTableRegion ownerId="issuer-register" label="Issuer coverage register" className="flex-1 min-h-0">
      <div className="h-full min-h-0">
        <Panel
          title="Issuer Register · coverage universe"
          className="h-full"
          right={
            <span className="flex items-center gap-2">
              <span className="tabular text-caos-xs text-caos-muted hidden xl:inline">
                click a row to open its profile
              </span>
              <span className="relative flex items-center">
                <span className="absolute left-2 text-caos-muted text-caos-md pointer-events-none">⌕</span>
                <TextInput
                  name="issuer-search"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search issuer · sector · country · FIGI…"
                  aria-label="Search issuers"
                  className="w-64 pl-6 pr-6 py-1 tabular text-caos-md"
                />
                {query ? (
                  <button
                    onClick={() => setQuery("")}
                    title="Clear search"
                    className="absolute right-1.5 text-caos-muted hover:text-caos-text text-caos-md transition-caos"
                  >
                    ✕
                  </button>
                ) : null}
              </span>
            </span>
          }
        >
          {selected.length > 0 ? (
            <div className="px-2 pt-2 pb-1">
              <BatchBar
                selected={selected}
                onClear={() => setSelected([])}
                itemLabel="issuer"
                itemName={(id) => issuers.find((issuer) => issuer.id === id)?.name ?? id}
                actions={batchActions}
              />
            </div>
          ) : null}
          {loading ? (
            <div className="text-caos-xl" role="status" aria-busy="true" aria-label="Loading issuers">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={COLS + " px-3 py-[7px] border-b border-caos-border/50"}>
                  <span />
                  <span className="h-2.5 w-9 rounded-sm bg-caos-elevated/70" />
                  <span className="h-2.5 w-44 rounded-sm bg-caos-elevated/70" />
                  <span className="h-2.5 w-8 rounded-sm bg-caos-elevated/70" />
                  <span className="h-2.5 w-24 rounded-sm bg-caos-elevated/70" />
                  <span className="h-2.5 w-20 rounded-sm bg-caos-elevated/70" />
                  <span className="h-2.5 w-16 rounded-sm bg-caos-elevated/70" />
                  <span />
                </div>
              ))}
            </div>
          ) : issuers.length === 0 && query ? (
            <div className="h-full flex items-center justify-center p-6">
              <SurfaceState
                kind="empty"
                title={`No matches for “${query}”`}
                detail="Search covers issuer name, ticker, sector, sub-sector, country, and FIGI."
                className="w-full max-w-md"
                primaryAction={<button type="button" onClick={() => setQuery("")} className="caos-action-primary focus-ring">Clear search</button>}
              />
            </div>
          ) : issuers.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6">
              <SurfaceState
                kind="empty"
                title="No issuers yet"
                detail="Add an issuer, ingest its deal documents, then select a run mode to establish the first observed analysis."
                className="w-full max-w-md"
                primaryAction={<button type="button" onClick={() => setShowForm(true)} className="caos-action-primary focus-ring">New issuer</button>}
              />
            </div>
          ) : shownIssuers.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6">
              <SurfaceState
                kind="empty"
                title="No rows match the active filters"
                detail={`${issuers.length} issuer${issuers.length === 1 ? " is" : "s are"} hidden by one or more column filters.`}
                className="w-full max-w-md"
                primaryAction={<button type="button" onClick={() => setFilters({})} className="caos-action-primary focus-ring">Clear filters</button>}
              />
            </div>
          ) : (
            <>
            <p id="issuer-register-grid-help" className="sr-only">
              Use Up and Down Arrow to move between issuer rows. Press Enter or Space to open the issuer profile. Press F2 to enter selection and upload actions; press Escape to return to the row.
            </p>
            <div role="grid" aria-label="Issuer coverage register" aria-rowcount={shownIssuers.length + 1} className="text-caos-xl">
              <div role="row" aria-rowindex={1} className={COLS + " px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-10"}>
                <span role="columnheader" className="flex items-center">
                  <input
                    type="checkbox"
                    name="select-all-visible-issuers"
                    autoComplete="off"
                    checked={allShownSelected}
                    onChange={toggleSelectAllShown}
                    aria-label={allShownSelected ? "Deselect all issuers" : "Select all issuers"}
                    className="min-h-8 min-w-8 shrink-0 accent-[var(--caos-accent)] focus-ring caos-target"
                  />
                </span>
                {["Ticker", "Issuer", "Rating", "Sector", "Sub-sector", "Country"].map((h, i) => (
                  <FilterHeader
                     key={i}
                     label={h}
                     col={FILTER_KEYS[i]}
                     rows={issuers}
                     getValue={filterVals[FILTER_KEYS[i]]}
                     selected={filters[FILTER_KEYS[i]]}
                     onChange={setFilter}
                     sortable={SORTABLE.has(FILTER_KEYS[i])}
                     sortState={sort}
                     onSort={cycleSort}
                     asHeaderCell
                     className="tabular text-caos-xs uppercase tracking-wider text-caos-muted"
                   >
                     {h}
                   </FilterHeader>
                ))}
                {/* Action column: no filter — the value is a constant UPLOAD button. */}
                <span role="columnheader" className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">
                  <span className="sr-only">Document intake</span>
                </span>
              </div>
              {/* ponytail: native content-visibility skips paint/layout for off-screen rows
                  — covers tens-to-hundreds of issuers. Swap to `virtua` only if a single book
                  ever holds thousands. intrinsic-size ≈ one row height, avoids scrollbar CLS. */}
              {/* fallow-ignore-next-line complexity -- Static virtualized row projection keeps selection and actions local. */}
              {shownIssuers.map((issuer, index) => {
                const focusProps = getIssuerRowFocusProps(issuer.id);
                const activate = () => openIssuer(issuer.id);
                return (
                  <div
                    key={issuer.id}
                    role="row"
                    ref={(element) => {
                      focusProps.ref(element);
                      if (element) {
                        rowRefs.current.set(issuer.id, element);
                        syncRowActionTabStops(element, actionRowId === issuer.id);
                      } else rowRefs.current.delete(issuer.id);
                    }}
                    tabIndex={actionRowId === issuer.id ? -1 : focusProps.tabIndex}
                    onFocus={focusProps.onFocus}
                    onBlur={(event) => {
                      if (actionRowId === issuer.id && !event.currentTarget.contains(event.relatedTarget as Node | null)) setActionRowId(null);
                    }}
                    aria-rowindex={index + 2}
                    aria-selected={selected.includes(issuer.id)}
                    aria-keyshortcuts="F2"
                    aria-describedby="issuer-register-grid-help"
                    aria-label={`${issuer.name} issuer details`}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("a, button, input, select, textarea, [role='button'], [role='link']")) return;
                      activate();
                    }}
                    onKeyDown={(event) => {
                      handleRovingActionRowKeyDown(event, issuer.id, actionRowId, setActionRowId, focusProps.onKeyDown, activate);
                    }}
                    className={COLS + " relative px-3 py-[7px] border-b border-caos-border/50 cursor-pointer outline-none transition-caos hover:bg-caos-elevated/60 focus-ring group [content-visibility:auto] [contain-intrinsic-size:auto_32px]"}
                  >
                  <span role="gridcell" className="relative z-[1] flex items-center min-h-[24px]">
                    <input
                      type="checkbox"
                      name={`select-issuer-${issuer.id}`}
                      autoComplete="off"
                      checked={selected.includes(issuer.id)}
                      onChange={() => toggleSelect(issuer.id)}
                      aria-label={`Select ${issuer.name}`}
                      className="min-h-8 min-w-8 shrink-0 accent-[var(--caos-accent)] focus-ring caos-target"
                    />
                  </span>
                  <span role="gridcell" className="tabular text-caos-accent text-caos-lg">
                    {issuer.ticker?.slice(0, 5).toUpperCase() || "—"}
                  </span>
                  <span role="rowheader" className="text-caos-text text-caos-xl font-semibold truncate transition-caos">
                    {/* The stretched mouse target lives inside the semantic row
                        header, so the ARIA row still owns exactly eight cells.
                        The row itself is the roving keyboard stop; the link stays
                        out of Tab order while preserving native link discovery. */}
                    <a
                      href={issuerProfileHref(issuer)}
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault();
                        openIssuer(issuer.id);
                      }}
                      aria-label={`Open profile for ${issuer.name}`}
                      className="absolute inset-0 z-0 cursor-pointer"
                    />
                    {issuer.name}
                  </span>
                  {(() => {
                    const r = issuerRating(issuer);
                    return (
                      <span
                        role="gridcell"
                        className="tabular text-caos-md truncate"
                        title={r ? "Agency rating — S&P / Moody's / Fitch (first on file)" : "No agency rating on file"}
                        style={{ color: r ? (ratingDistressed(r) ? "var(--caos-critical-bright)" : "var(--caos-text)") : "var(--caos-muted)" }}
                      >
                        {r || "—"}
                      </span>
                    );
                  })()}
                  <span role="gridcell" className="text-caos-muted text-caos-md truncate" title={issuerSector(issuer) ? undefined : "No sector on file"}>{issuerSector(issuer) || "—"}</span>
                  <span role="gridcell" className="text-caos-muted text-caos-md truncate" title={issuer.sub_sector ? undefined : "No sub-sector on file"}>{issuer.sub_sector || "—"}</span>
                  <span role="gridcell" className="text-caos-muted text-caos-md truncate" title={issuer.country ? undefined : "No country on file"}>{issuer.country || "—"}</span>
                  <span role="gridcell" className="relative z-[1] inline-flex items-center min-h-[24px]">
                    <button
                      onClick={() => router.push(analysis.context
                        ? contextHref("/upload", analysis.context.id, { issuer: issuer.id })
                        : "/upload?issuer=" + encodeURIComponent(issuer.id))}
                      aria-label={`Upload documents for ${issuer.name}`}
                      className="inline-flex items-center min-h-[24px] tabular text-caos-xs text-caos-muted hover:text-caos-text border border-caos-border rounded px-1.5 w-fit transition-caos focus-ring"
                    >
                      UPLOAD
                    </button>
                  </span>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </Panel>
      </div>
      </DominantTableRegion>
      </div>} />
      </div>

      {/* create modal */}
      {showForm ? (
        <NewIssuerModal
          onClose={() => setShowForm(false)}
          onCreated={(issuer) => {
            setIssuers((prev) => [...prev, issuer]);
            openIssuer(issuer.id);
          }}
        />
      ) : null}
    </EnterprisePage>
  );
}

// Create-issuer dialog — its own component so useModalA11y can run on
// mount/unmount (focus-trap + Escape + scroll-lock; the inline form couldn't,
// since a hook can't run conditionally). Owns the form + create call and hands
// the new issuer back to the directory via onCreated.
function NewIssuerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (issuer: Issuer) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const panelRef = useModalA11y<HTMLFormElement>(onClose);

  // fallow-ignore-next-line complexity -- Submit validation and server-error normalization are one create transaction.
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return; // guard against double-submit (would register duplicate issuers)
    setCreating(true);
    setCreateError(null);
    try {
      // sponsor is a grouping key for /api/sponsors — never persist "" as a group.
      onCreated(await createIssuer({ ...form, sponsor: form.sponsor.trim() || undefined }));
      onClose();
    } catch (err) {
      setCreateError(toErrorMessage(err, "Couldn't create the issuer. Check the details and try again."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="New issuer"
        onSubmit={handleCreate}
        onClick={(e) => e.stopPropagation()}
        className="caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-md overflow-hidden overscroll-contain"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="h-9 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/60">
          <span className="tabular text-caos-xl text-caos-text">New Issuer</span>
          <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-muted">registers to the coverage universe · opens its module route</span>
          <div className="flex-1" />
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-3 flex flex-col gap-2.5">
          {/* max mirrors the server caps (routes/issuers.py IssuerCreate + the
              issuers DB columns) so a length 422/500 is unreachable from typing */}
          {([
            { key: "name", label: "Company name", required: true, ph: "e.g. Atlas Forge Industrials…", max: 255 },
            { key: "ticker", label: "Ticker / CUSIP", required: false, ph: "e.g. ATLF…", max: 32 },
            { key: "sector", label: "Sector", required: false, ph: "e.g. Industrials…", max: 128 },
            { key: "sub_sector", label: "Sub-sector", required: false, ph: "e.g. Engineered Components…", max: 128 },
            { key: "figi", label: "FIGI", required: false, ph: "e.g. BBG00XK7LMN9…", max: 32 },
            { key: "sponsor", label: "Sponsor / PE owner", required: false, ph: "e.g. Kestrel Capital Partners…", max: 255 },
          ] as { key: keyof typeof EMPTY_FORM; label: string; required: boolean; ph: string; max: number }[]).map(({ key, label, required, ph, max }) => (
            <div key={key}>
              <label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">{label}{required ? " · required" : ""}</label>
              <TextInput required={required} name={`issuer-${key}`} autoComplete="off" spellCheck={key === "ticker" || key === "figi" ? false : undefined} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={ph} aria-label={label} maxLength={max} className="w-full px-2.5 py-1.5 text-caos-lg" />
            </div>
          ))}
          <div>
            <label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">Country</label>
            <select
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              aria-label="Country"
              className="w-full px-2.5 py-1.5 text-caos-lg rounded border border-caos-border bg-caos-bg text-caos-text focus-ring"
            >
              <option value="">—</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {createError ? (
          <div role="alert" className="px-3 pb-1 tabular text-caos-md" style={{ color: "var(--caos-critical)" }}>{createError}</div>
        ) : null}
        <div className="px-3 pb-3 flex gap-2">
          <ActionReason
            type="submit"
            reason={creating ? "Creating issuer…" : null}
            className="flex-1 tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent aria-disabled:hover:text-caos-accent"
          >
            {creating ? "CREATING…" : "CREATE ISSUER"}
          </ActionReason>
          <button type="button" onClick={onClose} className="px-3 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos">
            CANCEL
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
