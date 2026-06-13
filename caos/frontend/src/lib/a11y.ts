// Keyboard activation for elements promoted to role="button" — fires the
// handler on Enter or Space (and suppresses Space-scroll), matching native
// button behavior so clickable rows are operable without a mouse.

import type { KeyboardEvent } from "react";

export function onActivate(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}
