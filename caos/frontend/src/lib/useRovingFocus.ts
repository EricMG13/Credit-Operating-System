"use client";

// A general-purpose roving-tabindex hook for a flat, ordered collection of
// focusable items (grid cells, scatter points, launcher tiles, ...) — G7,
// design-rebuild WP-2. Exactly one item is a real tab stop at a time; arrow
// keys move which one, and DOM focus moves with it (true roving tabindex,
// not the aria-activedescendant "virtual focus" variant ModelSheet already
// uses for its grid — that pattern fits a dense spreadsheet with its own
// cell-address readout; this one fits a loose collection with no natural
// "cell address," like SectorRV's scatter points).
//
// Callers own rendering; this hook only decides which id is active and moves
// real DOM focus to it. `ids` should already be in the analyst-facing visual
// order (left-to-right / top-to-bottom) so arrow keys track what the eye
// sees, not incidental array order.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface RovingItemProps {
  tabIndex: 0 | -1;
  ref: (el: HTMLElement | SVGElement | null) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export interface UseRovingFocus {
  activeId: string | null;
  setActiveId: (id: string) => void;
  getItemProps: (id: string) => RovingItemProps;
}

export function useRovingFocus(ids: readonly string[]): UseRovingFocus {
  const [activeId, setActiveIdState] = useState<string | null>(ids[0] ?? null);
  const elRefs = useRef(new Map<string, HTMLElement | SVGElement>());

  // Keep the active id valid as the collection changes underneath (a sector
  // switch, a column filter, a chart-type toggle that stops rendering
  // points) — fall back to the first item rather than stranding roving
  // tabindex on an id nothing renders anymore (every item would end up
  // tabIndex={-1} and the whole collection would drop out of the tab order).
  useEffect(() => {
    if (activeId != null && ids.includes(activeId)) return;
    setActiveIdState(ids[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const setActiveId = useCallback((id: string) => setActiveIdState(id), []);

  const focusId = useCallback((id: string | undefined) => {
    if (id == null) return;
    setActiveIdState(id);
    elRefs.current.get(id)?.focus();
  }, []);

  const move = useCallback((delta: number) => {
    if (ids.length === 0) return;
    const i = activeId != null ? ids.indexOf(activeId) : -1;
    const next = i === -1 ? 0 : Math.max(0, Math.min(ids.length - 1, i + delta));
    focusId(ids[next]);
  }, [ids, activeId, focusId]);

  const getItemProps = useCallback((id: string): RovingItemProps => ({
    tabIndex: id === activeId ? 0 : -1,
    ref: (el) => { if (el) elRefs.current.set(id, el); else elRefs.current.delete(id); },
    onFocus: () => setActiveIdState(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      // Both axes walk the same 1D order — the items this hook manages
      // (scatter points, launcher tiles) don't carry a real row/column
      // address the way a spreadsheet grid does, so Right/Down and
      // Left/Up are equivalent "forward"/"back" through that order.
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Home") { e.preventDefault(); focusId(ids[0]); }
      else if (e.key === "End") { e.preventDefault(); focusId(ids[ids.length - 1]); }
    },
  }), [activeId, move, focusId, ids]);

  return useMemo(() => ({ activeId, setActiveId, getItemProps }), [activeId, setActiveId, getItemProps]);
}
