"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

/**
 * A popover drawer for contextual controls that don't fit in the sub-header
 * below 1280px. NOT a modal — no scroll-lock, no backdrop. The /adapt principle:
 * a popover is glance-and-return, not a commitment.
 *
 * Focus trap: Tab cycles within the drawer. Escape closes and returns focus to
 * the trigger. Outside click closes. Deliberately does NOT use useModalA11y
 * (which engages body scroll-lock — wrong for a popover).
 */
export function MoreDrawer({
  open,
  onOpenChange,
  children,
  triggerLabel = "More",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  triggerLabel?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus to the first focusable element when the drawer opens, so the
  // Tab trap works from the start. Stays on the trigger on close (restores).
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const raf = requestAnimationFrame(() => {
      const focusables = Array.from(
        panelRef.current!.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length > 0) focusables[0].focus();
      else panelRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Close on outside click (pointerdown so it fires before the click lands on
  // the page behind the drawer — a click on the page would otherwise navigate).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
      triggerRef.current?.focus();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  // Focus trap — Tab cycles within the drawer. Does NOT scroll-lock the body
  // (this is a popover, not a modal).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    // Recapture: if focus escaped (e.g. a control re-rendered disabled), pull
    // it back to the first focusable on the next Tab.
    if (!active || !panelRef.current.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap"
      >
        ⋯ {triggerLabel}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Contextual controls"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-[calc(100%+4px)] z-overlay w-64 rounded-md border border-caos-border bg-caos-panel p-2 flex flex-col gap-1"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}