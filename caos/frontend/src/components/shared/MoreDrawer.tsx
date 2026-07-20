"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

/**
 * A popover drawer for contextual controls that don't fit in the sub-header
 * below 1280px. NOT a modal — no scroll-lock, no backdrop. The /adapt principle:
 * a popover is glance-and-return, not a commitment.
 *
 * The panel is portaled to <body> with `position: fixed`, anchored to the
 * trigger rect, so it escapes any `overflow: hidden` / stacking-context
 * ancestor (e.g. SubHeader's truncating identity slot) instead of being
 * clipped. `align` picks which trigger edge the panel lines up with — "right"
 * for right-side utility drawers (default), "left" for a left-edge trigger like
 * the Concepts nav.
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
  align = "right",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  triggerLabel?: string;
  align?: "left" | "right";
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  // Anchor the fixed panel to the trigger rect. useLayoutEffect so the panel
  // never paints a frame at (0,0). Re-measures on open; window resize/scroll
  // just closes it (a popover is glance-and-return).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return; }
    const r = triggerRef.current.getBoundingClientRect();
    setPos(align === "left"
      ? { top: r.bottom + 4, left: r.left }
      : { top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open, align]);

  // Move focus to the first focusable element when the drawer opens, so the
  // Tab trap works from the start. Stays on the trigger on close (restores).
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length > 0) focusables[0].focus();
      else panel.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Close on outside click (pointerdown so it fires before the click lands on
  // the page behind the drawer — a click on the page would otherwise navigate).
  // Also close on scroll/resize since the fixed panel no longer tracks the
  // trigger (glance-and-return — reopening re-anchors).
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
    const onResize = () => onOpenChange(false);
    // Close when the PAGE scrolls (the fixed panel would detach from its
    // trigger), but ignore scrolls inside the panel's own list — auto-focus
    // scrolls that list on open and must not self-close the drawer.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
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
        aria-label={`Open ${triggerLabel}`}
        className="caos-utility-trigger tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap"
      >
        <span aria-hidden="true">⋯</span> <span className="caos-utility-trigger-label">{triggerLabel}</span>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          aria-label={triggerLabel}
          onKeyDown={onKeyDown}
          className="fixed z-overlay w-64 rounded-md border border-caos-border bg-caos-panel p-2 flex flex-col gap-1"
          style={{ boxShadow: "var(--shadow-pop)", top: pos.top, left: pos.left, right: pos.right }}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
