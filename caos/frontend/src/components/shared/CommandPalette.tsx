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
import { useModalListFocus } from "@/lib/use-modal-list-focus";

const usePaletteIssuers = (query: string) => {
  const [issuers, setIssuers] = useState<IssuerRow[]>([]);
  const [issuerError, setIssuerError] = useState(false);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setIssuers([]);
      setIssuerError(false);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      getIssuers(trimmed)
        .then((list) => {
          if (stale) return;
          setIssuers(list.slice(0, 6).map((issuer) => ({
            kind: "issuer" as const,
            id: issuer.id,
            label: issuer.name,
            sub: [issuer.ticker, issuer.sector].filter(Boolean).join(" · "),
          })));
          setIssuerError(false);
        })
        .catch(() => {
          if (stale) return;
          setIssuers([]);
          setIssuerError(true);
        });
    }, 150);
    return () => { stale = true; clearTimeout(timer); };
  }, [query]);
  return { issuers, issuerError };
};

const mergeIssuerRows = (query: string, issuers: IssuerRow[]): PaletteRow[] => {
  const base = staticRows(query);
  if (!issuers.length) return base;
  const rows: PaletteRow[] = [];
  let inserted = false;
  const normalizedQuery = query.trim().toLowerCase();
  for (const row of base) {
    const beforeAsk = row.kind === "ask";
    const beforeInexactPage = row.kind === "page" && !row.label.toLowerCase().startsWith(normalizedQuery);
    if (!inserted && (beforeAsk || beforeInexactPage)) {
      rows.push(...issuers);
      inserted = true;
    }
    rows.push(row);
  }
  if (!inserted) rows.push(...issuers);
  return rows;
};

const paletteRowKey = (row: PaletteRow): string => {
  if (row.kind === "page") return `page${row.href}`;
  if (row.kind === "ask") return "ask";
  return `${row.kind}${row.id}`;
};

function PaletteRowContent({ row }: { row: PaletteRow }) {
  if (row.kind === "page") return <><span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted w-16 shrink-0">{row.group}</span><span className="tabular text-caos-md text-caos-text">{row.label}</span></>;
  if (row.kind === "issuer") return <><span className="tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-16 shrink-0">Issuer</span><span className="tabular text-caos-md text-caos-text truncate">{row.label}</span>{row.sub ? <span className="tabular text-caos-xs text-caos-muted truncate">{row.sub}</span> : null}</>;
  if (row.kind === "action") return <><span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted w-16 shrink-0">Action</span><span className="tabular text-caos-md text-caos-text">{row.label}</span></>;
  return <><span className="tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-16 shrink-0">Ask</span><span className="tabular text-caos-md text-caos-text truncate">Ask CAOS: “{row.text}”</span></>;
}

function PaletteResults({
  rows,
  active,
  issuerError,
  onActiveChange,
  onExecute,
}: {
  rows: PaletteRow[];
  active: number;
  issuerError: boolean;
  onActiveChange: (index: number) => void;
  onExecute: (row: PaletteRow) => void;
}) {
  return (
    <ul id="palette-listbox" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto py-1">
      {issuerError ? <li role="none" className="px-2 py-1"><SurfaceState kind="offline" title="Issuer lookup unavailable" detail="Page and action commands remain available." compact /></li> : null}
      {rows.map((row, index) => (
        <li
          key={paletteRowKey(row)}
          id={`palette-row-${index}`}
          role="option"
          aria-selected={index === active}
          onMouseEnter={() => onActiveChange(index)}
          onMouseDown={(event) => { event.preventDefault(); onExecute(row); }}
          className={"flex items-baseline gap-2 px-3 min-h-9 py-1.5 cursor-pointer caos-target " + (index === active ? "bg-caos-elevated" : "")}
        >
          <PaletteRowContent row={row} />
        </li>
      ))}
      {rows.length === 0 ? <li className="px-3 py-2 tabular text-caos-xs text-caos-muted">no matches</li> : null}
    </ul>
  );
}

type PaletteKeyAction = "next" | "previous" | "execute";

const paletteKeyAction = (key: string): PaletteKeyAction | null => ({
  ArrowDown: "next" as const,
  ArrowUp: "previous" as const,
  Enter: "execute" as const,
})[key] ?? null;

function PaletteDialog({
  query,
  rows,
  issuerError,
  onQueryChange,
  onExecute,
  onClose,
}: {
  query: string;
  rows: PaletteRow[];
  issuerError: boolean;
  onQueryChange: (query: string) => void;
  onExecute: (row: PaletteRow) => void;
  onClose: () => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const [active, setActive] = useState(0);
  const inputRef = useModalListFocus(active, "palette-row-");
  useEffect(() => { setActive(0); }, [query, rows.length]);
  const onKeyDown = (event: React.KeyboardEvent) => {
    const action = paletteKeyAction(event.key);
    if (!action) return;
    event.preventDefault();
    if (action === "execute") {
      if (rows[active]) onExecute(rows[active]);
      return;
    }
    setActive((current) => action === "next"
      ? Math.min(current + 1, rows.length - 1)
      : Math.max(current - 1, 0));
  };
  return (
    <ModalBackdrop onClose={onClose} align="top">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()} className="caos-enter w-[560px] max-w-[92vw] max-h-[64vh] flex flex-col rounded-md border border-caos-border bg-caos-panel overflow-hidden" style={{ boxShadow: "var(--shadow-modal)" }}>
        <div className="flex items-center gap-2 border-b border-caos-border px-3">
          <span aria-hidden="true" className="tabular text-caos-xs text-caos-muted">⌘K</span>
          <input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="palette-listbox" aria-activedescendant={rows[active] ? `palette-row-${active}` : undefined} value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={onKeyDown} placeholder="Jump to a concept, find an issuer, run an action, or ask…" className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted min-h-11" />
          <span aria-hidden="true" className="tabular text-caos-2xs text-caos-muted border border-caos-border rounded px-1">esc</span>
        </div>
        <PaletteResults rows={rows} active={active} issuerError={issuerError} onActiveChange={setActive} onExecute={onExecute} />
      </div>
    </ModalBackdrop>
  );
}

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
  const router = useRouter();
  const attemptNavigation = useNavigationAttempt();
  const { openProfile } = useIssuerProfileOverlay();
  const { openWith } = useAsk();
  const { setRoleView } = useRoleView();

  const [query, setQuery] = useState("");
  const { issuers, issuerError } = usePaletteIssuers(query);
  const rows = useMemo(() => mergeIssuerRows(query, issuers), [query, issuers]);

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

  return <PaletteDialog query={query} rows={rows} issuerError={issuerError} onQueryChange={setQuery} onExecute={execute} onClose={onClose} />;
}
