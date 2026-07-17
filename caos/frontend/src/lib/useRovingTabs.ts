"use client";

// Roving-tabindex keyboard navigation for a horizontal or vertical group of
// items (radiogroup, tablist, segmented control) — the WAI-ARIA APG pattern:
// one item is in the Tab order (tabIndex 0), the rest are Tab-skipped
// (tabIndex -1), and arrow keys move focus AND activate the new item. Several
// hand-rolled groups in this app (RoleViewSwitch, login mode tabs, the
// Command dataset switcher) declared role="radio"/role="tab" — promising a
// screen-reader user arrow-key movement the markup never implemented, so Tab
// walked every option as a separate stop instead. This is the one place that
// logic lives now instead of being copy-pasted (and half-implemented) again.
//
// Scope: 1D groups only. A 2D grid (row + column navigation, e.g. the model
// sheet or a future DataTable) is a different shape — build that separately
// rather than forcing it through this hook's single active-index model.
import { useRef } from "react";

export function useRovingTabs(
  count: number,
  activeIndex: number,
  onActivate: (index: number) => void,
  options?: { orientation?: "horizontal" | "vertical" },
) {
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const orientation = options?.orientation ?? "horizontal";
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";

  const moveTo = (index: number) => {
    onActivate(index);
    itemRefs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (count === 0) return;
    if (event.key === nextKey) {
      event.preventDefault();
      moveTo((activeIndex + 1) % count);
    } else if (event.key === prevKey) {
      event.preventDefault();
      moveTo((activeIndex - 1 + count) % count);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(count - 1);
    }
  };

  const getItemProps = (index: number) => ({
    ref: (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown,
  });

  return { getItemProps };
}
