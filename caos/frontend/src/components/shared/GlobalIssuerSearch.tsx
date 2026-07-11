"use client";

import { useEffect, useRef, useState } from "react";
import { getIssuers } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { useIssuerProfileOverlay } from "./IssuerProfileOverlay";

export function GlobalIssuerSearch() {
  const { openProfile } = useIssuerProfileOverlay();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Issuer[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const focus = () => {
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener("caos:issuer-search-focus", focus);
    return () => window.removeEventListener("caos:issuer-search-focus", focus);
  }, []);

  useEffect(() => {
    let stale = false;
    const term = q.trim();
    if (term.length < 2) {
      setRows([]);
      setError(false);
      return;
    }
    const t = setTimeout(() => {
      getIssuers(term)
        .then((r) => { if (!stale) { setRows(r.slice(0, 6)); setError(false); } })
        // A failed lookup must NOT read as "no such issuer" (empty dropdown) — surface
        // it distinctly so the analyst retries instead of concluding the name isn't
        // registered. SEAM3-6.
        .catch(() => { if (!stale) { setRows([]); setError(true); } });
    }, 150);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  const pick = (issuer: Issuer) => {
    setQ("");
    setOpen(false);
    openProfile(issuer.id);
  };

  const hasText = q.trim().length > 0;
  return (
    <div className="group relative w-12 opacity-0 hover:opacity-100 focus-within:opacity-100 focus-within:w-64 hover:w-64 shrink-0 transition-[width,opacity] duration-150 motion-reduce:transition-none">
      {/* Invisible at rest, not merely faded — this floats over a different
          bottom-of-page content shape on every route (Command's QA drawer,
          Query's walk launcher, Pipeline's event log) and no single fixed
          offset clears all of them. Fully transparent means it can never
          visually occlude anything; hover/focus-within still reveal it, and
          the global Alt+S listener works regardless of visibility. */}
      <input
        ref={ref}
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && rows[0]) pick(rows[0]);
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Issuer search"
        aria-label="Global issuer search"
        title="Issuer search · Alt+S"
        className="w-full h-9 rounded-full border border-caos-accent/60 bg-caos-panel pl-3 pr-12 tabular text-caos-md text-caos-text placeholder:text-transparent group-hover:placeholder:text-caos-muted focus:placeholder:text-caos-muted outline-none transition-caos focus:border-caos-accent"
      />
      <span className="pointer-events-none absolute right-2 top-1.5 tabular text-caos-2xs px-1 rounded border border-caos-border text-caos-muted">
        {hasText ? "RET" : "ALT+S"}
      </span>
      {open && error && rows.length === 0 ? (
        <div className="absolute left-0 bottom-11 z-overlay w-72 rounded border bg-caos-panel shadow-lg overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)" }}>
          <div role="alert" className="px-2.5 py-1.5 text-caos-sm" style={{ color: "var(--caos-critical)" }}>
            Search unavailable — check your connection and retry.
          </div>
        </div>
      ) : open && rows.length > 0 ? (
        <div className="absolute left-0 bottom-11 z-overlay w-72 rounded border border-caos-border bg-caos-panel shadow-lg overflow-hidden">
          {rows.map((issuer) => (
            <button
              key={issuer.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(issuer)}
              className="w-full grid grid-cols-[58px_1fr] items-center gap-2 px-2.5 py-1.5 text-left border-b border-caos-border/50 last:border-b-0 hover:bg-caos-elevated transition-caos"
            >
              <span className="tabular text-caos-accent text-caos-sm">{issuer.ticker || "—"}</span>
              <span className="min-w-0">
                <span className="block text-caos-md text-caos-text truncate">{issuer.name}</span>
                <span className="block text-caos-2xs text-caos-muted truncate">{issuer.sector || issuer.industry || "—"}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
