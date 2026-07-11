// @vitest-environment jsdom
// FE-10: use-modal-a11y had zero test coverage despite 9 live consumers and
// being the app's sole Escape-to-close / focus-trap / scroll-lock hook
// (WCAG 2.4.3 / 2.1.2). Covers: Escape closes, focus trap keeps Tab/Shift+Tab
// inside the panel, body scroll-lock engages/releases, and the module-global
// refcount stays locked while a second (stacked) modal is still open.
import React, { useState } from "react";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { useModalA11y } from "./use-modal-a11y";

afterEach(cleanup);

beforeAll(() => {
  // jsdom does not run layout, so `HTMLElement.offsetParent` is always null —
  // the hook's focusables() filter uses offsetParent to skip display:none
  // elements. Left unstubbed, every element in these tests would look
  // "hidden" and focusables() would always return [], masking the real
  // Tab-trap branches under a fake "zero focusable elements" fallback. Stub
  // it to what a laid-out, visible element returns in a real browser (any
  // truthy value) so the trap logic under test is the one that actually runs.
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

// Minimal host mirroring how every real consumer wires the hook: a trigger
// outside the dialog, a panel carrying the ref + role="dialog", and
// focusable content inside. `extraButtons` toggles whether the panel has one
// or two focusable children (need two to exercise Tab-wrap in both directions).
function ModalHost({
  onClose,
  extraButtons = false,
}: {
  onClose: () => void;
  extraButtons?: boolean;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div>
      <button data-testid="outside-before">outside-before</button>
      <div ref={ref} role="dialog" aria-modal="true" data-testid="panel">
        <button data-testid="panel-first">first</button>
        {extraButtons && <button data-testid="panel-last">last</button>}
      </div>
      <button data-testid="outside-after">outside-after</button>
    </div>
  );
}

describe("useModalA11y", () => {
  it("closes the modal on Escape by calling onClose", () => {
    const onClose = vi.fn();
    render(<ModalHost onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not wire up Escape/focus-trap/scroll-lock when the consumer renders no panel (hook inactive while closed)", () => {
    function InactiveHost({ onCloseFn }: { onCloseFn: () => void }) {
      // Called unconditionally, as the comment above the hook says real
      // globally-mounted overlays do, but the ref never attaches to
      // anything because this component renders null while "closed".
      useModalA11y<HTMLDivElement>(onCloseFn);
      return null;
    }
    const onClose = vi.fn();
    render(<InactiveHost onCloseFn={onClose} />);

    expect(document.body.style.overflow).toBe("");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("auto-focuses the first focusable element in the panel on mount", () => {
    const onClose = vi.fn();
    render(<ModalHost onClose={onClose} extraButtons />);

    expect(document.activeElement).toBe(screen.getByTestId("panel-first"));
  });

  it("traps Tab/Shift+Tab inside the panel — never lands on an element outside it", () => {
    const onClose = vi.fn();
    render(<ModalHost onClose={onClose} extraButtons />);
    const first = screen.getByTestId("panel-first");
    const last = screen.getByTestId("panel-last");

    // Tab from the last focusable wraps to the first (does not escape to
    // "outside-after").
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first focusable wraps to the last (does not escape
    // to "outside-before").
    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("recaptures focus into the panel if it ends up outside (e.g. an external re-render dropped focus to the page)", () => {
    const onClose = vi.fn();
    render(<ModalHost onClose={onClose} extraButtons />);
    const first = screen.getByTestId("panel-first");
    const outside = screen.getByTestId("outside-after");

    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("locks body scroll while the modal is mounted and releases it on cleanup", () => {
    const onClose = vi.fn();
    const { unmount } = render(<ModalHost onClose={onClose} />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps scroll locked while a second, stacked modal is still open — only releases once the LAST one closes", () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    // Modal A opens first.
    const { unmount: unmountA } = render(<ModalHost onClose={onCloseA} />);
    expect(document.body.style.overflow).toBe("hidden");

    // Modal B stacks on top of A (e.g. a confirm dialog opened from within
    // A) while A is still mounted.
    const { unmount: unmountB } = render(<ModalHost onClose={onCloseB} />);
    expect(document.body.style.overflow).toBe("hidden");

    // Closing the BOTTOM modal (A) first must not unlock scroll — B is
    // still open. This is the refcount behavior a naive "reset on any
    // close" implementation would get wrong.
    unmountA();
    expect(document.body.style.overflow).toBe("hidden");

    // Closing the last remaining modal (B) releases the lock.
    unmountB();
    expect(document.body.style.overflow).toBe("");
  });

  it("stays locked through three stacked modals closing in an arbitrary (non-LIFO) order", () => {
    const noop = vi.fn();

    const m1 = render(<ModalHost onClose={noop} />);
    const m2 = render(<ModalHost onClose={noop} />);
    const m3 = render(<ModalHost onClose={noop} />);
    expect(document.body.style.overflow).toBe("hidden");

    // Close the middle one first.
    m2.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    m1.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    m3.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("restores focus to the previously-focused element after closing", () => {
    function ToggleableHost() {
      const [open, setOpen] = useState(false);
      const close = () => setOpen(false);
      return (
        <div>
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            open
          </button>
          {open && <ModalHost onClose={close} />}
        </div>
      );
    }
    render(<ToggleableHost />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);

    expect(document.activeElement).toBe(screen.getByTestId("panel-first"));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(document.activeElement).toBe(trigger);
  });
});
