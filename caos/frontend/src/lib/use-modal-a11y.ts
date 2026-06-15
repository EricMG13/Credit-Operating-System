import { useEffect, useRef } from "react";

// Modal behavior in one place — consolidates the per-modal Escape-to-close
// effect that was copy-pasted across every overlay, and adds the focus
// management none of them had:
//   • Escape closes (stopPropagation so nested overlays don't double-fire).
//   • Focus trap — Tab cycles within the dialog; focus can't leak to the page
//     behind it (WCAG 2.4.3 / 2.1.2).
//   • Focus restore — returns focus to the trigger element on close.
//   • Body scroll-lock while open.
// Attach the returned ref to the dialog panel and pair it with
// role="dialog" aria-modal="true". Components only (it runs on mount/unmount).
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Keep the latest onClose in a ref so the setup effect runs exactly once (on
  // mount) yet always calls the current handler. Callers pass inline arrows, and
  // timer-driven parents (e.g. the Command Center sim clock) re-render while a
  // modal is open — depending on [onClose] would re-run the whole effect each
  // tick, re-stealing focus and thrashing the scroll-lock.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const panel = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (panel && !panel.hasAttribute("tabindex")) panel.tabIndex = -1;

    const focusables = (): HTMLElement[] =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    // Prefer the first form field (a form modal should land on its first input,
    // not the close button); else the first focusable; else the panel itself.
    const initial = focusables();
    const firstField = initial.find((el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    (firstField ?? initial[0] ?? panel)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  return ref;
}
