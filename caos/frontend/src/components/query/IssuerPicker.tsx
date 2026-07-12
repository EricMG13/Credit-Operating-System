"use client";

// A compact, embeddable issuer autocomplete for inline pickers (e.g. the
// head-to-head walk's two-issuer compare bar). Deliberately not
// GlobalIssuerSearch — that component is a fixed-position global nav
// singleton bound to Alt+S; this one is a plain field usable twice on the
// same page.

import { useEffect, useState } from "react";
import { getIssuers } from "@/lib/api";
import type { Issuer } from "@/types/issuers";

interface IssuerPickerProps {
  id: string;
  label: string;
  placeholder?: string;
  onPick: (issuer: Issuer) => void;
}

export function IssuerPicker({ id, label, placeholder, onPick }: IssuerPickerProps) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Issuer[]>([]);
  const [open, setOpen] = useState(false);

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
    setQ(issuer.name);
    setOpen(false);
    onPick(issuer);
  };

  return (
    <div className="relative min-w-[10rem]">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder={placeholder || label}
        aria-label={label}
        className="min-w-[10rem] bg-caos-bg border border-caos-border rounded px-2 py-1 tabular text-caos-sm text-caos-text placeholder:text-caos-muted outline-none focus:border-caos-accent/70 transition-caos"
      />
      {open && rows.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-overlay w-64 rounded border border-caos-border bg-caos-panel shadow-lg overflow-hidden">
          {rows.map((issuer) => (
            <button
              key={issuer.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(issuer)}
              className="w-full text-left px-2.5 py-1.5 text-caos-sm text-caos-text hover:bg-caos-elevated transition-caos truncate"
            >
              {issuer.name}{issuer.ticker ? ` (${issuer.ticker})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
