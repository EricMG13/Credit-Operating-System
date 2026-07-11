"use client";

// The global ⌘K command palette: pages (workflow-grouped from lib/nav),
// issuers (same debounced search contract as GlobalIssuerSearch), global
// actions, and an ever-present `Ask CAOS: "<text>"` passthrough row that
// routes typed text into the Ask launcher via openWith() — the old ⌘K→Ask
// muscle memory keeps working for question-shaped input (RT-2026-07-11-62).
// Alt+K still opens Ask directly (ConceptHotkeys, unchanged).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { staticRows, type PaletteRow, type IssuerRow } from "@/lib/palette";
import { getIssuers } from "@/lib/api";
import { useIssuerProfileOverlay } from "./IssuerProfileOverlay";
import { useAsk } from "./Ask";
import { useRoleView } from "./RoleViewProvider";
import type { RoleView } from "@/lib/api";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  // ⌘K / Ctrl+K — owned here (Firefox's native ⌘K needs preventDefault).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return <PalettePanel onClose={() => setOpen(false)} />;
}

function PalettePanel({ onClose }: { onClose: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const router = useRouter();
  const { openProfile } = useIssuerProfileOverlay();
  const { openWith } = useAsk();
  const { setRoleView } = useRoleView();

  const [query, setQuery] = useState("");
  const [issuers, setIssuers] = useState<IssuerRow[]>([]);
  const [active, setActive] = useState(0);

  // Issuer search — 2+ chars, 150ms debounce, top 6 (GlobalIssuerSearch's
  // contract); errors degrade to no issuer rows, never a broken palette.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setIssuers([]);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      getIssuers(q)
        .then((list) => {
          if (stale) return;
          setIssuers(
            list.slice(0, 6).map((i) => ({
              kind: "issuer" as const,
              id: i.id,
              label: i.name,
              sub: [i.ticker, i.sector].filter(Boolean).join(" · "),
            })),
          );
        })
        .catch(() => {
          if (!stale) setIssuers([]);
        });
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  const rows: PaletteRow[] = useMemo(() => {
    const base = staticRows(query);
    if (!issuers.length) return base;
    // Issuer hits are strong matches — slot them directly under any exact page
    // hit and above the ask row when it leads.
    const out: PaletteRow[] = [];
    let inserted = false;
    for (const r of base) {
      if (!inserted && (r.kind === "ask" || (r.kind === "page" && !r.label.toLowerCase().startsWith(query.trim().toLowerCase())))) {
        out.push(...issuers);
        inserted = true;
      }
      out.push(r);
    }
    if (!inserted) out.push(...issuers);
    return out;
  }, [query, issuers]);

  useEffect(() => {
    setActive(0);
  }, [query, issuers.length]);

  const execute = useCallback(
    (row: PaletteRow) => {
      onClose();
      if (row.kind === "page") {
        router.push(row.href);
      } else if (row.kind === "issuer") {
        openProfile(row.id);
      } else if (row.kind === "ask") {
        openWith(row.text || undefined);
      } else if (row.kind === "action") {
        if (row.id === "collapse") window.dispatchEvent(new Event("caos:collapse-toggle"));
        else setRoleView(row.id.replace("role-", "") as RoleView);
      }
    },
    [onClose, router, openProfile, openWith, setRoleView],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) execute(rows[active]);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-[12vh] bg-black/50">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[560px] max-w-[92vw] max-h-[64vh] flex flex-col rounded-md border border-caos-border bg-caos-panel shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-caos-border px-3">
          <span aria-hidden="true" className="tabular text-caos-xs text-caos-muted">
            ⌘K
          </span>
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={rows[active] ? `palette-row-${active}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a concept, find an issuer, run an action, or ask…"
            className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted min-h-11"
          />
          <span aria-hidden="true" className="tabular text-caos-2xs text-caos-muted border border-caos-border rounded px-1">
            esc
          </span>
        </div>
        <ul id="palette-listbox" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto py-1">
          {rows.map((row, i) => (
            <li
              key={row.kind + (row.kind === "page" ? row.href : row.kind === "issuer" ? row.id : row.kind === "action" ? row.id : "ask")}
              id={`palette-row-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                execute(row);
              }}
              className={
                "flex items-baseline gap-2 px-3 min-h-9 py-1.5 cursor-pointer caos-target " +
                (i === active ? "bg-caos-elevated" : "")
              }
            >
              {row.kind === "page" ? (
                <>
                  <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted w-16 shrink-0">
                    {row.group}
                  </span>
                  <span className="tabular text-caos-md text-caos-text">{row.label}</span>
                </>
              ) : row.kind === "issuer" ? (
                <>
                  <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-16 shrink-0">
                    Issuer
                  </span>
                  <span className="tabular text-caos-md text-caos-text truncate">{row.label}</span>
                  {row.sub ? <span className="tabular text-caos-xs text-caos-muted truncate">{row.sub}</span> : null}
                </>
              ) : row.kind === "action" ? (
                <>
                  <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted w-16 shrink-0">
                    Action
                  </span>
                  <span className="tabular text-caos-md text-caos-text">{row.label}</span>
                </>
              ) : (
                <>
                  <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-16 shrink-0">
                    Ask
                  </span>
                  <span className="tabular text-caos-md text-caos-text truncate">
                    Ask CAOS: “{row.text}”
                  </span>
                </>
              )}
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="px-3 py-2 tabular text-caos-xs text-caos-muted">no matches</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
