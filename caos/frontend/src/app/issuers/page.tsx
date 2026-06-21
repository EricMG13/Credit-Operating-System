"use client";

// Issuer Directory — the workspace hub, in the CAOS design language shared by
// the five concept sections: h-10 sub-header, dense tabular rows, panel chrome.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getIssuers, createIssuer } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { TextInput } from "@/components/shared/TextInput";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { onActivate } from "@/lib/a11y";
import { PORTFOLIO } from "@/lib/command/data";

export default function IssuersPage() {
  return (
    <RequireAuth>
      <IssuersDirectory />
    </RequireAuth>
  );
}


const EMPTY_FORM = { name: "", ticker: "", industry: "", country: "", figi: "" };

// Demo coverage universe shown when the registry is empty, so the entry point
// reflects the same names the rest of the app works against (Command, Deep-Dive)
// instead of dead-ending on "no issuers yet".
const DEMO_UNIVERSE: Issuer[] = PORTFOLIO.map((p) => ({
  id: p.code,
  name: p.name,
  ticker: p.code,
  industry: p.sector,
  country: "United States",
}));

function IssuersDirectory() {
  const router = useRouter();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

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
            `${i.name} ${i.ticker ?? ""} ${i.industry ?? ""}`.toLowerCase().includes(q)
          )
        : DEMO_UNIVERSE;
    };
    const t = setTimeout(() => {
      getIssuers(query)
        .then((rows) => {
          if (stale) return;
          setIssuers(rows.length > 0 ? rows : demoFiltered());
        })
        // Network/500 → degrade to the demo directory instead of a blank table
        // and an unhandled rejection.
        .catch(() => { if (!stale) setIssuers(demoFiltered()); })
        .finally(() => { if (!stale) setLoading(false); });
    }, query ? 200 : 0);
    return () => { stale = true; clearTimeout(t); };
  }, [query]);

  const cols = "grid grid-cols-[64px_minmax(200px,1.5fr)_1fr_1fr_110px_120px_90px] items-center gap-x-3";

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

      {/* directory */}
      <div className="flex-1 min-h-0 p-2">
        <Panel
          title="Issuer Register · coverage universe"
          className="h-full"
          right={
            <span className="flex items-center gap-2">
              <span className="tabular text-caos-xs text-caos-muted hidden xl:inline">
                click a row to open its deep-dive
              </span>
              <span className="relative flex items-center">
                <span className="absolute left-2 text-caos-muted text-caos-md pointer-events-none">⌕</span>
                <TextInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search issuer · industry · country · FIGI"
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
                Search covers issuer name, ticker, industry, country, and FIGI.
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
                {["Ticker", "Issuer", "Industry", "Country", "FIGI", "Documents", ""].map((h, i) => (
                  <span key={i} className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">{h}</span>
                ))}
              </div>
              {/* ponytail: native content-visibility skips paint/layout for off-screen rows
                  — covers tens-to-hundreds of issuers. Swap to `virtua` only if a single book
                  ever holds thousands. intrinsic-size ≈ one row height, avoids scrollbar CLS. */}
              {issuers.map((issuer) => (
                <div
                  key={issuer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push("/deepdive")}
                  onKeyDown={onActivate(() => router.push("/deepdive"))}
                  aria-label={`Open deep-dive for ${issuer.name}`}
                  className={cols + " px-3 py-[7px] border-b border-caos-border/50 cursor-pointer transition-caos hover:bg-caos-elevated/60 focus-ring group [content-visibility:auto] [contain-intrinsic-size:auto_32px]"}
                >
                  <span className="tabular text-caos-accent text-caos-lg">
                    {issuer.ticker?.slice(0, 5).toUpperCase() || "—"}
                  </span>
                  <span className="text-caos-text text-caos-xl truncate group-hover:text-white transition-caos">{issuer.name}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuer.industry || "—"}</span>
                  <span className="text-caos-muted text-caos-md truncate">{issuer.country || "—"}</span>
                  <span className="tabular text-caos-muted text-caos-sm truncate">{issuer.figi || "—"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push("/upload?issuer=" + encodeURIComponent(issuer.id)); }}
                    aria-label={`Upload documents for ${issuer.name}`}
                    className="tabular text-caos-xs text-caos-muted hover:text-caos-text border border-caos-border rounded px-1.5 py-0.5 w-fit transition-caos focus-ring"
                  >
                    + UPLOAD
                  </button>
                  <span className="tabular text-caos-xs text-caos-muted text-right group-hover:text-caos-accent transition-caos">OPEN →</span>
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
            // New issuer registered — direct to the Execution Graph so the user
            // sees the CP-X module route planned for it.
            router.push("/pipeline");
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
          <button type="button" onClick={onClose} aria-label="Close" className="w-5 h-5 rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-caos-md focus-ring">✕</button>
        </div>
        <div className="p-3 flex flex-col gap-2.5">
          {([
            { key: "name", label: "Company name", required: true, ph: "e.g. Atlas Forge Industrials" },
            { key: "ticker", label: "Ticker / CUSIP", required: false, ph: "e.g. ATLF" },
            { key: "industry", label: "Industry", required: false, ph: "e.g. Industrials" },
            { key: "country", label: "Country", required: false, ph: "e.g. United States" },
            { key: "figi", label: "FIGI", required: false, ph: "e.g. BBG00XK7LMN9" },
          ] as { key: keyof typeof EMPTY_FORM; label: string; required: boolean; ph: string }[]).map(({ key, label, required, ph }) => (
            <div key={key}>
              <label className="block tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1">{label}{required ? " · required" : ""}</label>
              <TextInput
                required={required}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={ph}
                aria-label={label}
                className="w-full px-2.5 py-1.5 text-caos-lg"
              />
            </div>
          ))}
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
