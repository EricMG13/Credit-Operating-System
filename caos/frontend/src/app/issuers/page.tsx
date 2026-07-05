"use client";

// Issuer Register — the workspace hub, in the CAOS design language shared by
// the five concept sections: h-10 sub-header, dense tabular rows, panel chrome.

import { useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getIssuers, createIssuer, toErrorMessage } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import { TextInput } from "@/components/shared/TextInput";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { COUNTRIES, DEMO_UNIVERSE, issuerProfileHref, issuerRating, issuerSector, ratingDistressed } from "@/lib/issuers";
import { FilterHeader, useColumnFilters, type FilterState, type SortState } from "@/components/shared/TableColumnFilter";

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
const EMPTY_FORM = { name: "", ticker: "", sector: "", sub_sector: "", country: "", figi: "" };

// fallow-ignore-next-line complexity
function IssuersDirectory() {
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

  const cols = "grid grid-cols-[60px_minmax(200px,1.7fr)_78px_1fr_1fr_104px_84px] items-center gap-x-3";
  const filterKeys = ["ticker", "name", "rating", "sector", "sub_sector", "country", "action"] as const;
  const filterVals = useMemo<Record<(typeof filterKeys)[number], (issuer: Issuer) => string | number | null | undefined>>(() => ({
    ticker: (i) => i.ticker?.slice(0, 5).toUpperCase() || "—",
    name: (i) => i.name,
    rating: (i) => issuerRating(i) || "—",
    sector: (i) => issuerSector(i) || "—",
    sub_sector: (i) => i.sub_sector || "—",
    country: (i) => i.country || "—",
    action: () => "UPLOAD",
  }), []);
  const filteredIssuers = useColumnFilters(issuers, filters, filterVals);
  // Sortable columns only (the trailing action column is not orderable).
  const SORTABLE = useMemo(() => new Set<string>(["ticker", "name", "rating", "sector", "sub_sector", "country"]), []);
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
  }, [filteredIssuers, sort, SORTABLE, filterVals]);
  const cycleSort = (col: string) =>
    setSort((s) =>
      s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null
    );
  const ratedCount = useMemo(() => issuers.filter((i) => issuerRating(i)).length, [issuers]);
  const setFilter = (col: string, values: string[] | undefined) =>
    setFilters((f) => {
      const next = { ...f };
      if (values === undefined) {
        delete next[col];
      } else {
        next[col] = values;
      }
      return next;
    });

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-sm flex items-center justify-center text-caos-md font-bold" style={{ background: "var(--caos-accent)", color: "var(--caos-bg)" }}>C</span>
          <span className="text-caos-2xl font-semibold tracking-wide text-caos-text whitespace-nowrap">CREDIT OS</span>
          <span className="tabular text-caos-xs text-caos-muted border border-caos-border rounded px-1 py-px">v2.2</span>
        </span>
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-caos-metric text-caos-text font-semibold whitespace-nowrap">Issuer Register</span>
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate">
          {loading
            ? "loading…"
            : query
            ? issuers.length + (issuers.length === 1 ? " match" : " matches") + " for “" + query + "”"
            : demo
            ? DEMO_UNIVERSE.length + " sample issuers"
            : issuers.length + " issuers" + (ratedCount ? " · " + ratedCount + " rated" : "") + " · US HY sleeve"}
        </span>
        {!loading && demo ? (
          <span
            className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
            style={{ borderColor: "var(--caos-border)", color: "var(--caos-muted)" }}
            title="No live coverage yet — these are sample issuers, not real coverage"
          >
            Demo coverage
          </span>
        ) : null}
        <div className="flex-1" />
        <ConceptNav />
        <div className="h-4 w-px bg-caos-border" />
        <Link
          href="/upload"
          className="no-underline tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
        >
          UPLOAD DOCUMENTS
        </Link>
        <button
          onClick={() => setShowForm(true)}
          className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
        >
          + NEW ISSUER
        </button>
      </div>

      {/* degraded banner — registry fetch failed; demo coverage shown is NOT live */}
      {degraded ? (
        <div
          role="alert"
          className="shrink-0 mx-2 mt-2 flex items-center gap-2 px-3 py-1.5 rounded border tabular text-caos-sm"
          style={{ borderColor: "var(--caos-warning)", background: "color-mix(in srgb, var(--caos-warning) 12%, transparent)", color: "var(--caos-text)" }}
        >
          <StatusGlyph kind="warning" />
          {hadRealCoverage.current ? (
            <span>Couldn’t reach the registry — showing <span className="font-medium" style={{ color: "var(--caos-warning)" }}>the last loaded results</span>, which may be out of date.</span>
          ) : (
            <span>Couldn’t reach the registry — showing <span className="font-medium" style={{ color: "var(--caos-warning)" }}>demo coverage</span>, not live data.</span>
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
      <div className="flex-1 min-h-0 p-2">
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search issuer · sector · country · FIGI"
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
          {loading ? (
            <div className="text-caos-xl" aria-busy="true" aria-label="Loading issuers">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={cols + " px-3 py-[7px] border-b border-caos-border/50"}>
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
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-caos-text/85 text-caos-hero font-semibold">No matches for “{query}”</p>
              <p className="text-caos-muted text-caos-lg max-w-xs">
                Search covers issuer name, ticker, sector, sub-sector, country, and FIGI.
              </p>
              <button
                onClick={() => setQuery("")}
                className="mt-1 tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
              >
                CLEAR SEARCH
              </button>
            </div>
          ) : issuers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-caos-text/85 text-caos-hero font-semibold">No issuers yet</p>
              <p className="text-caos-muted text-caos-lg max-w-xs">
                Add your first issuer, then drop its deal documents and pick a run mode to start a run.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
              >
                + NEW ISSUER
              </button>
            </div>
          ) : shownIssuers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-caos-text/85 text-caos-hero font-semibold">No rows match the active column filters</p>
              <p className="text-caos-muted text-caos-lg max-w-xs">
                {issuers.length} issuer{issuers.length === 1 ? "" : "s"} in the register are hidden by the filters set on one or more columns.
              </p>
              <button
                onClick={() => setFilters({})}
                className="mt-1 tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
              >
                CLEAR FILTERS
              </button>
            </div>
          ) : (
            <div className="text-caos-xl">
              <div className={cols + " px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-10"}>
                {["Ticker", "Issuer", "Rating", "Sector", "Sub-sector", "Country", ""].map((h, i) => (
                  <FilterHeader
                    key={i}
                    label={h || "Action"}
                    col={filterKeys[i]}
                    rows={issuers}
                    getValue={filterVals[filterKeys[i]]}
                    selected={filters[filterKeys[i]]}
                    onChange={setFilter}
                    sortable={SORTABLE.has(filterKeys[i])}
                    sortState={sort}
                    onSort={cycleSort}
                    className="tabular text-caos-xs uppercase tracking-wider text-caos-muted"
                  >
                    {h}
                  </FilterHeader>
                ))}
              </div>
              {/* ponytail: native content-visibility skips paint/layout for off-screen rows
                  — covers tens-to-hundreds of issuers. Swap to `virtua` only if a single book
                  ever holds thousands. intrinsic-size ≈ one row height, avoids scrollbar CLS. */}
              {/* fallow-ignore-next-line complexity */}
              {shownIssuers.map((issuer) => (
                <div
                  key={issuer.id}
                  className={cols + " relative px-3 py-[7px] border-b border-caos-border/50 cursor-pointer transition-caos hover:bg-caos-elevated/60 group [content-visibility:auto] [contain-intrinsic-size:auto_32px]"}
                >
                  {/* Stretched primary link: whole row is the click target for mouse,
                      and a single keyboard/SR-focusable control per row. Replaces the
                      former role="button" row, which nested the Upload button inside an
                      interactive element (WCAG 4.1.2 Name/Role/Value; axe nested-interactive). */}
                  <a
                    href={issuerProfileHref(issuer)}
                    onClick={(e) => {
                      e.preventDefault();
                      openProfile(issuer.id);
                    }}
                    aria-label={`Open profile for ${issuer.name}`}
                    className="absolute inset-0 z-0 focus-ring cursor-pointer"
                  />
                  <span className="tabular text-caos-accent text-caos-lg">
                    {issuer.ticker?.slice(0, 5).toUpperCase() || "—"}
                  </span>
                  <span className="text-caos-text text-caos-xl font-semibold truncate group-hover:text-[#f2f2f7] transition-caos">{issuer.name}</span>
                  {(() => {
                    const r = issuerRating(issuer);
                    return (
                      <span
                        className="tabular text-caos-md truncate"
                        title={r ? "Agency rating — S&P / Moody’s / Fitch (first on file)" : "No agency rating on file"}
                        style={{ color: r ? (ratingDistressed(r) ? "var(--caos-critical-bright)" : "var(--caos-text)") : "var(--caos-muted)" }}
                      >
                        {r || "—"}
                      </span>
                    );
                  })()}
                  <span className="text-caos-muted text-caos-md truncate">{issuerSector(issuer) || "—"}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuer.sub_sector || "—"}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuer.country || "—"}</span>
                  <button
                    onClick={() => router.push("/upload?issuer=" + encodeURIComponent(issuer.id))}
                    aria-label={`Upload documents for ${issuer.name}`}
                    className="relative z-[1] inline-flex items-center min-h-[24px] tabular text-caos-xs text-caos-muted hover:text-caos-text border border-caos-border rounded px-1.5 w-fit transition-caos focus-ring"
                  >
                    UPLOAD
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* create modal */}
      {showForm ? (
        <NewIssuerModal
          onClose={() => setShowForm(false)}
          onCreated={(issuer) => {
            setIssuers((prev) => [...prev, issuer]);
            openProfile(issuer.id);
          }}
        />
      ) : null}
    </div>
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

  // fallow-ignore-next-line complexity
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return; // guard against double-submit (would register duplicate issuers)
    setCreating(true);
    setCreateError(null);
    try {
      onCreated(await createIssuer(form));
      onClose();
    } catch (err) {
      setCreateError(toErrorMessage(err, "Couldn't create the issuer. Check the details and try again."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center" style={{ background: "rgba(5,5,7,0.72)" }} onClick={onClose}>
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
            { key: "name", label: "Company name", required: true, ph: "e.g. Atlas Forge Industrials", max: 255 },
            { key: "ticker", label: "Ticker / CUSIP", required: false, ph: "e.g. ATLF", max: 32 },
            { key: "sector", label: "Sector", required: false, ph: "e.g. Industrials", max: 128 },
            { key: "sub_sector", label: "Sub-sector", required: false, ph: "e.g. Engineered Components", max: 128 },
            { key: "figi", label: "FIGI", required: false, ph: "e.g. BBG00XK7LMN9", max: 32 },
          ] as { key: keyof typeof EMPTY_FORM; label: string; required: boolean; ph: string; max: number }[]).map(({ key, label, required, ph, max }) => (
            <div key={key}>
              <label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">{label}{required ? " · required" : ""}</label>
              <TextInput required={required} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={ph} aria-label={label} maxLength={max} className="w-full px-2.5 py-1.5 text-caos-lg" />
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
          <button type="submit" disabled={creating} className="flex-1 tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-caos-accent">
            {creating ? "CREATING…" : "CREATE ISSUER"}
          </button>
          <button type="button" onClick={onClose} className="px-3 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos">
            CANCEL
          </button>
        </div>
      </form>
    </div>
  );
}
