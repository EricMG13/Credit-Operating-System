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

// Shared topmost-overlay registry. Every useModalA11y instance registers a
// window-level keydown listener, and stopPropagation() on a window listener
// does not stop OTHER listeners on the same target — it only stops
// propagation to ANCESTOR nodes, which doesn't exist for window listeners.
// Without this, one Escape press fired every currently-mounted overlay's
// onClose at once (e.g. a citation viewer opened inside the Ask modal: Esc
// meant to dismiss just the citation closed the whole Ask stack instead,
// losing the in-progress query/graph/reader state). Each instance pushes a
// token on mount, pops it on unmount, and only the topmost (most recently
// opened) instance's Escape handler actually calls onClose.
const overlayStack: symbol[] = [];
function isTopOverlay(token: symbol): boolean {
  return overlayStack[overlayStack.length - 1] === token;
}
/** True while any useModalA11y-tracked overlay is mounted. Lets a non-hook
    Escape handler (e.g. a coordinator that isn't itself a dialog panel) defer
    to whichever tracked overlay is currently topmost, instead of racing it. */
export function hasOpenModalA11yOverlay(): boolean {
  return overlayStack.length > 0;
}

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
    const token = Symbol("modal-a11y-overlay");
    overlayStack.push(token);
    if (scrollLockCount === 0) document.body.style.overflow = "hidden";
    scrollLockCount++;
    if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;

    const focusables = (): HTMLElement[] =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    // Prefer the first form field (a form modal should land on its first input,
    // not the close button); else the first focusable; else the panel itself.
    const initial = focusables();
    const firstField = initial.find((el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    (firstField ?? initial[0] ?? panel)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        // Not topmost — a nested overlay (e.g. a citation viewer opened over
        // this dialog) owns this Escape; its own handler will fire the same
        // event, since window listeners aren't stopped by stopPropagation.
        if (!isTopOverlay(token)) return;
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
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
      const i = overlayStack.indexOf(token);
      if (i !== -1) overlayStack.splice(i, 1);
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.body.style.overflow = "";
      prevFocus?.focus?.();
    };
  }, []);

  return ref;
}
