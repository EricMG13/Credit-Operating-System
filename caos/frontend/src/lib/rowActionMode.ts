// Keyboard action-mode utilities for row-focused tables and ARIA grids.
// Rows stay as the single default Tab stop; F2 temporarily exposes only that
// row's nested controls, and Escape/blur lets the caller close the mode again.

export const ROW_ACTION_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[tabindex]",
].join(", ");

export function syncRowActionTabStops(row: HTMLElement, enabled: boolean) {
  row.querySelectorAll<HTMLElement>(ROW_ACTION_SELECTOR).forEach((action) => {
    if (action.dataset.rowOriginalTabindex === undefined) {
      action.dataset.rowOriginalTabindex = action.getAttribute("tabindex") ?? "";
    }
    const authorDisabled = action.matches(":disabled, [aria-disabled='true']");
    const authorNegative = action.dataset.rowOriginalTabindex.startsWith("-");
    const available = enabled && !authorDisabled && !authorNegative;
    action.tabIndex = available ? 0 : -1;
    action.dataset.rowActionStop = available ? "true" : "false";
  });
}

export function focusFirstRowAction(row: HTMLElement) {
  syncRowActionTabStops(row, true);
  const firstAction = row.querySelector<HTMLElement>("[data-row-action-stop='true']");
  firstAction?.focus();
  return firstAction != null;
}
