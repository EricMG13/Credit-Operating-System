"use client";

import { useEffect, useId, useRef, useState } from "react";
import { StatusGlyph } from "./StatusGlyph";

export type EvidenceSourceEffect =
  | { kind: "href"; href: string; title?: string }
  | { kind: "callback"; onOpen: (id: string) => void; title?: string };

export interface EvidenceSelectionItem {
  id: string;
  label: string;
  description?: string;
  status?: string;
  effect: EvidenceSourceEffect;
}

export interface EvidenceSelectionListProps {
  label: string;
  items: readonly EvidenceSelectionItem[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelectedChange?: (id: string) => void;
  emptyLabel?: string;
  className?: string;
}

function initialSelection(items: readonly EvidenceSelectionItem[], preferred?: string) {
  return items.some((item) => item.id === preferred) ? preferred! : items[0]?.id ?? "";
}

function rowName(item: EvidenceSelectionItem) {
  return [item.id, item.label, item.description, item.status].filter(Boolean).join(" · ");
}

function evidenceValidationError(items: readonly EvidenceSelectionItem[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id.trim() || ids.has(item.id)) {
      return "Evidence register unavailable · source IDs must be non-empty and unique.";
    }
    ids.add(item.id);
  }
  return null;
}

/**
 * A register/listbox contract: rows only select evidence; exactly one shared
 * action performs the selected source effect. No arbitrary row-render escape
 * is exposed, so register consumers cannot reintroduce one opener per row.
 */
export function EvidenceSelectionList({
  label,
  items,
  selectedId,
  defaultSelectedId,
  onSelectedChange,
  emptyLabel = "No registered evidence",
  className = "",
}: EvidenceSelectionListProps) {
  const validationError = evidenceValidationError(items);
  const listId = useId();
  const [internalSelectedId, setInternalSelectedId] = useState(() => initialSelection(items, defaultSelectedId));
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const requestedId = selectedId ?? internalSelectedId;
  const activeId = initialSelection(items, requestedId);
  const activeItem = items.find((item) => item.id === activeId);

  useEffect(() => {
    if (selectedId === undefined && activeId !== internalSelectedId) setInternalSelectedId(activeId);
  }, [activeId, internalSelectedId, selectedId]);

  if (validationError) {
    return <div role="alert" className={`rounded border border-caos-critical/50 bg-caos-critical/5 px-3 py-2 text-caos-xs text-caos-critical-bright${className ? ` ${className}` : ""}`}>{validationError}</div>;
  }

  const select = (id: string, focus = false) => {
    if (selectedId === undefined) setInternalSelectedId(id);
    onSelectedChange?.(id);
    if (focus) rowRefs.current.get(id)?.focus();
  };

  const move = (currentId: string, key: string) => {
    const index = items.findIndex((item) => item.id === currentId);
    if (index < 0 || !items.length) return;
    let nextIndex = index;
    if (key === "ArrowDown") nextIndex = (index + 1) % items.length;
    else if (key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
    else if (key === "Home") nextIndex = 0;
    else if (key === "End") nextIndex = items.length - 1;
    else return;
    select(items[nextIndex].id, true);
  };

  if (!activeItem) return <div role="note" className={`px-3 py-2 text-caos-xs text-caos-muted${className ? ` ${className}` : ""}`}>{emptyLabel}</div>;

  const actionClass = "focus-ring inline-flex min-h-7 items-center justify-center rounded border border-caos-accent px-2.5 py-1 tabular text-caos-xs uppercase text-caos-accent no-underline transition-caos hover:bg-caos-accent hover:text-caos-bg";
  const actionName = `Open source ${activeItem.id} — ${activeItem.label}`;
  const actionTitle = activeItem.effect.title ?? actionName;

  return (
    <div className={`min-w-0${className ? ` ${className}` : ""}`}>
      <div role="listbox" aria-label={label} className="flex min-w-0 flex-col">
        {items.map((item, index) => {
          const selected = item.id === activeItem.id;
          return (
            <div
              key={item.id}
              id={`${listId}-evidence-option-${index + 1}`}
              ref={(node) => { if (node) rowRefs.current.set(item.id, node); else rowRefs.current.delete(item.id); }}
              role="option"
              aria-label={rowName(item)}
              aria-selected={selected}
              aria-posinset={index + 1}
              aria-setsize={items.length}
              tabIndex={selected ? 0 : -1}
              onClick={(event) => { select(item.id); event.currentTarget.focus(); }}
              onFocus={() => { if (!selected) select(item.id); }}
              onKeyDown={(event) => {
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  move(item.id, event.key);
                } else if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  select(item.id);
                }
              }}
              className={`focus-ring grid min-w-0 cursor-default grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-caos-border/60 px-3 py-1.5 text-left transition-caos ${selected ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:bg-caos-elevated/50 hover:text-caos-text"}`}
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="tabular text-caos-xs text-caos-accent whitespace-nowrap">{item.id}</span>
                  <span className="truncate text-caos-sm">{item.label}</span>
                </span>
                {item.description ? <span className="block truncate text-caos-xs text-caos-muted">{item.description}</span> : null}
              </span>
              <span className="inline-flex items-center gap-1 tabular text-caos-3xs uppercase tracking-wide whitespace-nowrap" style={{ color: selected ? "var(--caos-accent)" : "var(--caos-muted)" }}>
                <StatusGlyph kind={selected ? "success" : "idle"} size={8} />
                {selected ? "Selected" : item.status ?? "Available"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate tabular text-caos-xs text-caos-muted">Selected {activeItem.id}</span>
        {activeItem.effect.kind === "href" ? (
          <a href={activeItem.effect.href} title={actionTitle} aria-label={actionName} className={actionClass}>Open source</a>
        ) : (
          <button type="button" title={actionTitle} aria-label={actionName} className={actionClass} onClick={() => activeItem.effect.kind === "callback" && activeItem.effect.onOpen(activeItem.id)}>Open source</button>
        )}
      </div>
    </div>
  );
}
