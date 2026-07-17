"use client";

// The global ⌘K command palette: pages (workflow-grouped from lib/nav),
// issuers (using the shared debounced issuer-search contract), global
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
import { ModalBackdrop } from "./ModalBackdrop";
import { SurfaceState } from "./SurfaceState";
import { useNavigationAttempt } from "./NavigationGuardProvider";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // Mirrors `open` for the keydown handler: dispatching caos:modal-open from
  // inside the setOpen updater ran other components' listeners during THIS
  // component's render phase (React: "Cannot update ShortcutHelp while
  // rendering CommandPalette"). The handler decides from the ref and
  // dispatches before setting state — never inside the updater.
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  // ⌘K / Ctrl+K and the shared explicit-open event are owned here. Alt+S
  // dispatches the latter from ConceptHotkeys so issuer lookup and page/action
  // search stay one surface instead of competing global search widgets.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        const willOpen = !openRef.current;
        if (willOpen) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "palette" } }));
        setOpen(willOpen);
      }
    };
    const onOpen = () => {
      window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "palette" } }));
      setOpen(true);
    };
    const onModalOpen = (event: Event) => {
      if ((event as CustomEvent<{ owner?: string }>).detail?.owner !== "palette") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("caos:command-palette-open", onOpen);
    window.addEventListener("caos:modal-open", onModalOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("caos:command-palette-open", onOpen);
      window.removeEventListener("caos:modal-open", onModalOpen);
    };
  }, []);

  if (!open) return null;
  return <PalettePanel onClose={() => setOpen(false)} />;
}

function PalettePanel({ onClose }: { onClose: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const attemptNavigation = useNavigationAttempt();
  const { openProfile } = useIssuerProfileOverlay();
  const { openWith } = useAsk();
  const { setRoleView } = useRoleView();

  const [query, setQuery] = useState("");
  const [issuers, setIssuers] = useState<IssuerRow[]>([]);
  const [issuerError, setIssuerError] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Issuer search — 2+ chars, 150ms debounce, top 6 (the prior standalone search's
  // contract); errors degrade to no issuer rows, never a broken palette.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setIssuers([]);
      setIssuerError(false);
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
          setIssuerError(false);
        })
        .catch(() => {
          if (!stale) {
            setIssuers([]);
            setIssuerError(true);
          }
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
        attemptNavigation(() => router.push(row.href));
      } else if (row.kind === "issuer") {
        openProfile(row.id);
      } else if (row.kind === "ask") {
        openWith(row.text || undefined);
      } else if (row.kind === "action") {
        if (row.id === "collapse") window.dispatchEvent(new Event("caos:collapse-toggle"));
        else setRoleView(row.id.replace("role-", "") as RoleView);
      }
    },
    [attemptNavigation, onClose, router, openProfile, openWith, setRoleView],
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
    <ModalBackdrop onClose={onClose} align="top">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="caos-enter w-[560px] max-w-[92vw] max-h-[64vh] flex flex-col rounded-md border border-caos-border bg-caos-panel overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="flex items-center gap-2 border-b border-caos-border px-3">
          <span aria-hidden="true" className="tabular text-caos-xs text-caos-muted">
            ⌘K
          </span>
          <input
            ref={inputRef}
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
          {issuerError ? (
            <li role="none" className="px-2 py-1">
              <SurfaceState kind="offline" title="Issuer lookup unavailable" detail="Page and action commands remain available." compact />
            </li>
          ) : null}
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
    </ModalBackdrop>
  );
}
