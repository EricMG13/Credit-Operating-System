import type { KeyboardEvent } from "react";
import { focusFirstRowAction } from "@/lib/rowActionMode";

type ActionRowKeyboardOptions<Element extends HTMLElement> = {
  rowId: string;
  actionRowId: string | null;
  setActionRowId: (id: string | null) => void;
  onNavigate?: (event: KeyboardEvent<Element>) => void;
  onActivate: () => void;
};

export function handleActionRowKeyDown<Element extends HTMLElement>(event: KeyboardEvent<Element>, options: ActionRowKeyboardOptions<Element>) {
  if (event.key === "Escape" && options.actionRowId === options.rowId) {
    event.preventDefault();
    options.setActionRowId(null);
    event.currentTarget.focus();
    return;
  }
  if (event.currentTarget !== event.target) return;
  if (event.key === "F2") {
    if (focusFirstRowAction(event.currentTarget)) {
      event.preventDefault();
      options.setActionRowId(options.rowId);
    }
    return;
  }
  options.onNavigate?.(event);
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  options.onActivate();
}

export function handleRovingActionRowKeyDown<Element extends HTMLElement>(
  event: KeyboardEvent<Element>,
  rowId: string,
  actionRowId: string | null,
  setActionRowId: (id: string | null) => void,
  onNavigate: (event: KeyboardEvent<Element>) => void,
  onActivate: () => void,
) {
  handleActionRowKeyDown(event, {
    rowId,
    actionRowId,
    setActionRowId,
    onNavigate: (keyEvent) => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(keyEvent.key)) return;
      setActionRowId(null);
      onNavigate(keyEvent);
    },
    onActivate,
  });
}
