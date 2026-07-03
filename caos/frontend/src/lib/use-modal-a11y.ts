import { useEffect, useRef } from "react";

// Body scroll-lock is refcounted across all open overlays, not saved/restored
// per-modal. Two reasons: (1) a per-modal save-string desyncs when overlay
// lifecycles interleave (open B while A is open, close A first) — A's unmount
// would unlock while B is still open, or leave a stuck `overflow:hidden` with no
// dialog on screen; (2) capturing a "previous" value is a trap here — this hook
// is the ONLY writer of body overflow in the app, so the previous value is
// always "". Once a buggy restore left "hidden" behind, every later modal
// captured and re-restored "hidden" forever. So: lock on first open, and on the
// last close clear the inline style outright rather than restore a captured one.
// ponytail: module-global counter — fine for one window; a portal/iframe multi-
// document app would need per-document state.
let scrollLockCount = 0;

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
    // A consumer that calls this hook unconditionally but renders `null` while
    // closed (e.g. a globally-mounted overlay) must not engage the lock/trap —
    // otherwise it pins body scroll-lock the whole time it sits closed. No panel
    // on screen ⇒ no modal ⇒ no side effects.
    if (!panel) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    if (scrollLockCount === 0) document.body.style.overflow = "hidden";
    scrollLockCount++;
    if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;

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
      const active = document.activeElement as HTMLElement | null;
      // Recapture: if focus has escaped the panel (e.g. the control that had
      // focus re-rendered `disabled` and dropped focus to <body>), the next Tab
      // pulls it back in rather than walking the page behind the modal.
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
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
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.body.style.overflow = "";
      prevFocus?.focus?.();
    };
  }, []);

  return ref;
}
