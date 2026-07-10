"use client";

// Per-analyst coverage watchlist — the Desk Brief scoping surface (Phase-2
// personalization). The analyst pins the issuers they follow; the backend
// rebuilds a per-analyst evidence pack (deltas/findings scoped to these
// issuers) and keys the cached brief by analyst_id. An empty watchlist falls
// back to the shared book-level brief, so this editor never produces a blank
// panel — clearing it is a documented "use the book brief" action.
//
// Composition: a self-contained panel that loads its own watchlist + issuer
// list, manages a local selection, and saves the full set on submit. The parent
// (QueryWorkspace) passes `onSaved` so a save triggers a brief force-refresh.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getIssuers, getWatchlist, saveWatchlist } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { useNotify } from "@/components/shared/Notifications";

export function WatchlistEditor({ onSaved }: { onSaved: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const notify = useNotify();
  // The candidate list is keyed off the search query so a 200-issuer book is
  // not rendered as a 200-row wall; empty query = no candidates (the analyst
  // types to discover). The selected chips are always visible above it.
  const [candidates, setCandidates] = useState<Issuer[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the current watchlist once on mount.
  useEffect(() => {
    let cancelled = false;
    getWatchlist()
      .then((w) => { if (!cancelled) setSelected(new Set(w.issuer_ids)); })
      .catch(() => { /* read-only state; absence just means empty */ })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Debounced issuer search — only fetch when the analyst types ≥2 chars so a
  // stray keystroke doesn't pull the whole book.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setCandidates([]); return; }
    debounceRef.current = setTimeout(() => {
      getIssuers(q)
        .then(setCandidates)
        .catch(() => setCandidates([]));
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const sortedSelected = useMemo(
    () => [...selected].sort((a, b) => a.localeCompare(b)),
    [selected],
  );
  const selectedMeta = useMemo(() => {
    // Name lookup for the chips — candidates may not include every selected
    // issuer (e.g. one pinned then the search cleared), so fall back to the id.
    const m = new Map(candidates.map((i) => [i.id, i]));
    return m;
  }, [candidates]);

  const save = useCallback(() => {
    setSaving(true);
    setErr(null);
    saveWatchlist(sortedSelected)
      .then(() => {
        setSelected(new Set(sortedSelected));
        notify("Watchlist saved", sortedSelected.length
          ? `Desk Brief scoped to ${sortedSelected.length} issuer${sortedSelected.length === 1 ? "" : "s"}`
          : "Falls back to the book-level brief");
        onSaved();
      })
      .catch((e) => {
        const d = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
          || (e as Error)?.message || "could not save watchlist";
        setErr(String(d));
      })
      .finally(() => setSaving(false));
  }, [sortedSelected, notify, onSaved]);

  return (
    <div className="rounded-md border border-caos-border bg-caos-panel/60 p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted font-semibold">
          My watchlist
        </span>
        <span className="tabular text-caos-3xs text-caos-muted font-mono">
          {loaded ? `${selected.size} pinned` : "…"}
        </span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="tabular text-caos-3xs text-caos-muted hover:text-caos-warning transition-caos focus-ring rounded px-1"
            aria-label="Clear watchlist (fall back to book-level brief)"
          >
            CLEAR
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={saving || !loaded}
          className="tabular text-caos-2xs uppercase tracking-wider px-2 py-0.5 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-caos focus-ring"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Selected issuers as removable chips. */}
      {sortedSelected.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Watched issuers">
          {sortedSelected.map((id) => {
            const meta = selectedMeta.get(id);
            const label = meta?.name ?? id.slice(0, 8);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  title={meta ? `${meta.name}${meta.ticker ? ` · ${meta.ticker}` : ""}` : id}
                  className="group tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-critical/15 hover:border-caos-critical/50 hover:text-caos-critical transition-caos focus-ring inline-flex items-center gap-1"
                  aria-label={`Remove ${label} from watchlist`}
                  aria-pressed={true}
                >
                  <span>{label}</span>
                  <span aria-hidden className="text-caos-3xs">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Search + candidate list. */}
      <div className="flex flex-col gap-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search issuers to pin (name, ticker, sector)"
          aria-label="Search issuers to add to watchlist"
          className="bg-caos-bg border border-caos-border rounded px-2 py-1 text-caos-sm text-caos-text placeholder:text-caos-muted outline-none focus:border-caos-accent/70 transition-caos focus-ring"
        />
        {candidates.length > 0 && (
          <ul role="listbox" aria-label="Issuer search results" className="max-h-44 overflow-auto rounded border border-caos-border/70 bg-caos-bg/40">
            {candidates.map((i) => {
              const on = selected.has(i.id);
              return (
                <li key={i.id} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => toggle(i.id)}
                    aria-pressed={on}
                    className={`w-full text-left px-2 py-1 flex items-center gap-2 transition-caos focus-ring ${on ? "bg-caos-accent/15" : "hover:bg-caos-elevated/50"}`}
                  >
                    <span className="tabular text-caos-3xs text-caos-muted w-3 shrink-0" aria-hidden>{on ? "✓" : ""}</span>
                    <span className="text-caos-sm text-caos-text truncate">{i.name}</span>
                    {i.ticker ? <span className="tabular text-caos-3xs text-caos-muted shrink-0">{i.ticker}</span> : null}
                    {i.sector ? <span className="tabular text-caos-3xs text-caos-muted shrink-0 truncate">· {i.sector}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {err && (
          <div role="alert" className="tabular text-caos-2xs text-caos-warning">{err}</div>
        )}
      </div>
    </div>
  );
}
