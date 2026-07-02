"use client";

// Issuer Directory — the workspace hub, in the CAOS design language shared by
// the five concept sections: h-10 sub-header, dense tabular rows, panel chrome.

import { useEffect, useMemo, useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getIssuers, createIssuer } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import { TextInput } from "@/components/shared/TextInput";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { COUNTRIES, DEMO_UNIVERSE, issuerProfileHref, issuerSector } from "@/lib/issuers";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";

export default function IssuersPage() {
  return (
    <RequireAuth>
      <IssuersDirectory />
    </RequireAuth>
  );
}


const EMPTY_FORM = { name: "", ticker: "", sector: "", sub_sector: "", country: "", figi: "", rating_sp: "", rating_moody: "", rating_fitch: "" };

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
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<FilterState>({});

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
          setIssuers(rows.length > 0 ? rows : demoFiltered());
        })
        // Network/500 → degrade to the demo directory (so it's not a blank table
        // or an unhandled rejection) AND flag it, so the banner can say so.
        .catch(() => { if (!stale) { setDegraded(true); setIssuers(demoFiltered()); } })
        .finally(() => { if (!stale) setLoading(false); });
    }, query ? 200 : 0);
    return () => { stale = true; clearTimeout(t); };
  }, [query, reloadKey]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  const cols = "grid grid-cols-[64px_minmax(200px,1.5fr)_1fr_1fr_110px_120px_90px] items-center gap-x-3";
  const filterKeys = ["ticker", "name", "sector", "sub_sector", "country", "figi", "action"] as const;
  const filterVals = useMemo<Record<(typeof filterKeys)[number], (issuer: Issuer) => string | number | null | undefined>>(() => ({
    ticker: (i) => i.ticker?.slice(0, 5).toUpperCase() || "—",
    name: (i) => i.name,
    sector: (i) => issuerSector(i) || "—",
    sub_sector: (i) => i.sub_sector || "—",
    country: (i) => i.country || "—",
    figi: (i) => i.figi || "—",
    action: () => "UPLOAD",
  }), []);
  const shownIssuers = useColumnFilters(issuers, filters, filterVals);
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
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Issuer Directory</span>
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate">
          {loading
            ? "loading…"
            : query
            ? issuers.length + (issuers.length === 1 ? " match" : " matches") + " for “" + query + "”"
            : issuers.length + " issuers · US HY sleeve"}
        </span>
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
          <span>Couldn’t reach the registry — showing <span className="font-medium" style={{ color: "var(--caos-warning)" }}>demo coverage</span>, not live data.</span>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="ml-1 tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
          >
            RETRY
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
            <div className="px-3 py-3 text-caos-lg text-caos-muted">Loading issuers…</div>
          ) : issuers.length === 0 && query ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-caos-text/85 text-caos-2xl font-medium">No matches for “{query}”</p>
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
              <p className="text-caos-text/85 text-caos-2xl font-medium">No issuers yet</p>
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
          ) : (
            <div className="text-caos-xl">
              <div className={cols + " px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-10"}>
                {["Ticker", "Issuer", "Sector", "Sub-sector", "Country", "FIGI", ""].map((h, i) => (
                  <FilterHeader
                    key={i}
                    label={h || "Action"}
                    col={filterKeys[i]}
                    rows={issuers}
                    getValue={filterVals[filterKeys[i]]}
                    selected={filters[filterKeys[i]]}
                    onChange={setFilter}
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
                  <span className="text-caos-text text-caos-xl truncate group-hover:text-white transition-caos">{issuer.name}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuerSector(issuer) || "—"}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuer.sub_sector || "—"}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuer.country || "—"}</span>
                  <span className="tabular text-caos-muted text-caos-sm truncate">{issuer.figi || "—"}</span>
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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(detail || "Couldn't create the issuer. Check the details and try again.");
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
          {([
            { key: "name", label: "Company name", required: true, ph: "e.g. Atlas Forge Industrials" },
            { key: "ticker", label: "Ticker / CUSIP", required: false, ph: "e.g. ATLF" },
            { key: "sector", label: "Sector", required: false, ph: "e.g. Industrials" },
            { key: "sub_sector", label: "Sub-sector", required: false, ph: "e.g. Engineered Components" },
            { key: "figi", label: "FIGI", required: false, ph: "e.g. BBG00XK7LMN9" },
            { key: "rating_sp", label: "S&P rating", required: false, ph: "e.g. B+" },
            { key: "rating_moody", label: "Moody’s rating", required: false, ph: "e.g. B1" },
            { key: "rating_fitch", label: "Fitch rating", required: false, ph: "e.g. BB-" },
          ] as { key: keyof typeof EMPTY_FORM; label: string; required: boolean; ph: string }[]).map(({ key, label, required, ph }) => (
            <div key={key}>
              <label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">{label}{required ? " · required" : ""}</label>
              <TextInput required={required} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={ph} aria-label={label} className="w-full px-2.5 py-1.5 text-caos-lg" />
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
