"use client";

// Shared right-edge slide-over — one modal primitive for per-row detail views
// (Sector Review's signal detail, P2-WP-7) instead of nested interactive
// controls inside a list item (Sam's red-flag: one click target per row, the
// detail lives here). Built on the same ModalBackdrop + useModalA11y contract
// every other overlay in the app uses (focus trap/restore, Escape, scroll-lock).

import type { ReactNode } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { useModalA11y } from "@/lib/use-modal-a11y";

export function SlideOver({
  title,
  onClose,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <ModalBackdrop onClose={onClose} align="end">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-[420px] max-w-[92vw] flex flex-col border-l border-caos-border bg-caos-panel shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-caos-border px-3 min-h-10 shrink-0">
          <span className="tabular text-caos-sm font-semibold text-caos-text flex-1 min-w-0 truncate">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="tabular text-caos-xs text-caos-muted hover:text-caos-text px-1.5 min-h-8 min-w-8 rounded border border-caos-border focus-ring caos-target"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">{children}</div>
      </div>
    </ModalBackdrop>
  );
}
