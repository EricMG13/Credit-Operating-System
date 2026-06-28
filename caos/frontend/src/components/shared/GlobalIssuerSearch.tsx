"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getIssuers } from "@/lib/api";
import { issuerProfileHref } from "@/lib/issuers";
import type { Issuer } from "@/types/issuers";

export function GlobalIssuerSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Issuer[]>([]);
  const [open, setOpen] = useState(false);

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
      return;
    }
    const t = setTimeout(() => {
      getIssuers(term)
        .then((r) => { if (!stale) setRows(r.slice(0, 6)); })
        .catch(() => { if (!stale) setRows([]); });
    }, 150);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  const pick = (issuer: Issuer) => {
    setQ("");
    setOpen(false);
    router.push(issuerProfileHref(issuer));
  };

  const hasText = q.trim().length > 0;
  return (
    <div className="relative w-64 shrink-0">
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
        aria-label="Search issuers"
        className="w-full h-9 rounded-full border border-caos-accent/60 bg-caos-panel pl-3 pr-12 tabular text-caos-md text-caos-text placeholder:text-caos-muted outline-none transition-caos focus:border-caos-accent"
      />
      <span className="pointer-events-none absolute right-2 top-1.5 tabular text-caos-2xs px-1 rounded border border-caos-border text-caos-muted">
        {hasText ? "RET" : "SP+S"}
      </span>
      {open && rows.length > 0 ? (
        <div className="absolute right-0 bottom-11 z-overlay w-72 rounded border border-caos-border bg-caos-panel shadow-lg overflow-hidden">
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
