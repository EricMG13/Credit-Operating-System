"use client";

// Searchable module finder for Deep-Dive's 19-module launcher — ⌘M opens a
// combobox over MODULES (id/name/description), roving arrow-key focus.
// Pins/recents persist to the analyst's workspace settings
// (updateAnalystWorkspace, P2-WP-0's read-modify-write wrapper); on a 404
// (local-dev bypass identity with no profile row) they simply stay
// local-only for the session — no error surfaced, matching
// RoleViewProvider's same fallback contract. The existing 7-group accordion
// stays mounted as browse-all; this is an additive fast path, not a
// replacement.

import { useEffect, useMemo, useState } from "react";
import { MODULES } from "@/lib/pipeline/data";
import { getAnalystSettings, updateAnalystWorkspace } from "@/lib/api";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { useModalListFocus } from "@/lib/use-modal-list-focus";

const MAX_PINS = 12;
const MAX_RECENTS = 8;

type FinderKeyAction = "next" | "previous" | "select";

const finderKeyAction = (key: string): FinderKeyAction | null => ({
  ArrowDown: "next" as const,
  ArrowUp: "previous" as const,
  Enter: "select" as const,
})[key] ?? null;

const moveFinderSelection = (
  current: number,
  action: Exclude<FinderKeyAction, "select">,
  resultCount: number,
): number => action === "next"
  ? Math.min(current + 1, resultCount - 1)
  : Math.max(current - 1, 0);

function ModuleShortcut({ module, active, pinned, onSelect }: {
  module: (typeof MODULES)[number];
  active: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(module.id)}
      title={module.name}
      aria-current={active ? "true" : undefined}
      className={
        "tabular text-caos-sm px-2 min-h-8 rounded border transition-caos focus-ring whitespace-nowrap shrink-0 caos-target " +
        (active ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
      }
    >
      {pinned ? "★ " : ""}{module.id}
    </button>
  );
}

function readList(ws: Record<string, unknown> | undefined, key: string): string[] {
  const v = ws?.[key];
  return Array.isArray(v) ? (v.filter((x): x is string => typeof x === "string")) : [];
}

export function ModuleFinder({
  onSelect,
  activeId,
}: {
  onSelect: (id: string) => void;
  activeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    getAnalystSettings()
      .then((s) => {
        if (!alive) return;
        setPins(readList(s.workspace, "deepdive_pins"));
        setRecents(readList(s.workspace, "deepdive_recents"));
      })
      .catch(() => {
        // No profile row (local-dev bypass) — pins/recents stay empty/local
        // for this session; togglePin/select below still update local state.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const togglePin = (id: string) => {
    const next = pins.includes(id) ? pins.filter((p) => p !== id) : [id, ...pins].slice(0, MAX_PINS);
    setPins(next);
    updateAnalystWorkspace((ws) => ({ ...ws, deepdive_pins: next })).catch(() => {});
  };

  const select = (id: string) => {
    onSelect(id);
    setOpen(false);
    const next = [id, ...recents.filter((r) => r !== id)].slice(0, MAX_RECENTS);
    setRecents(next);
    updateAnalystWorkspace((ws) => ({ ...ws, deepdive_recents: next })).catch(() => {});
  };

  const pinnedMods = pins.map((id) => MODULES.find((m) => m.id === id)).filter((m): m is (typeof MODULES)[number] => !!m);
  const recentMods = recents
    .filter((id) => !pins.includes(id))
    .slice(0, 4)
    .map((id) => MODULES.find((m) => m.id === id))
    .filter((m): m is (typeof MODULES)[number] => !!m);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Find a module by id or name (⌘M)"
        className="tabular text-caos-2xs uppercase tracking-wider px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap shrink-0 caos-target"
      >
        ⌘M find module…
      </button>
      {pinnedMods.map((module) => <ModuleShortcut key={module.id} module={module} active={activeId === module.id} pinned onSelect={select} />)}
      {recentMods.map((module) => <ModuleShortcut key={module.id} module={module} active={activeId === module.id} pinned={false} onSelect={select} />)}
      {open ? <ModuleFinderModal onClose={() => setOpen(false)} onSelect={select} pins={pins} onTogglePin={togglePin} /> : null}
    </>
  );
}

function ModuleFinderModal({
  onClose,
  onSelect,
  pins,
  onTogglePin,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
  pins: string[];
  onTogglePin: (id: string) => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useModalListFocus(active, "module-finder-row-");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q),
    );
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const action = finderKeyAction(e.key);
    if (!action) return;
    e.preventDefault();
    if (action === "select") {
      const selected = results[active];
      if (selected) onSelect(selected.id);
      return;
    }
    setActive((current) => moveFinderSelection(current, action, results.length));
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find module"
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-w-[92vw] max-h-[70vh] flex flex-col rounded-md border border-caos-border bg-caos-panel shadow-2xl overflow-hidden"
      >
        <div className="border-b border-caos-border px-3">
          <input
            ref={inputRef}
            name="module-finder"
            autoComplete="off"
            role="combobox"
            aria-label="Find a module"
            aria-expanded="true"
            aria-controls="module-finder-listbox"
            aria-activedescendant={results[active] ? `module-finder-row-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Find a module by id or name…"
            className="w-full bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted min-h-11"
          />
        </div>
        <ul id="module-finder-listbox" role="listbox" aria-label="Modules" className="flex-1 overflow-y-auto py-1">
          {results.map((m, i) => (
            <li
              key={m.id}
              id={`module-finder-row-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(m.id);
              }}
              className={
                "flex items-center gap-2 px-3 min-h-9 py-1.5 cursor-pointer caos-target " +
                (i === active ? "bg-caos-elevated" : "")
              }
            >
              <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-14 shrink-0">{m.id}</span>
              <span className="tabular text-caos-md text-caos-text truncate flex-1 min-w-0">{m.name}</span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTogglePin(m.id);
                }}
                aria-pressed={pins.includes(m.id)}
                title={pins.includes(m.id) ? "Unpin" : "Pin"}
                className="tabular text-caos-sm px-1 min-h-8 min-w-8 rounded hover:bg-caos-bg/60 focus-ring caos-target shrink-0"
              >
                {pins.includes(m.id) ? "★" : "☆"}
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-4 tabular text-caos-xs text-caos-muted">no matching module</li>
          ) : null}
        </ul>
      </div>
    </ModalBackdrop>
  );
}
