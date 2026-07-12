// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProfileSectionNav } from "./ProfileSectionNav";

afterEach(cleanup);

const SECTIONS = [
  { id: "sec-a", label: "Snapshot" },
  { id: "sec-b", label: "Trends" },
];

describe("ProfileSectionNav", () => {
  it("renders nothing when there are no sections", () => {
    const { container } = render(<ProfileSectionNav sections={[]} scrollRoot={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a link + a select option per section", () => {
    render(<ProfileSectionNav sections={SECTIONS} scrollRoot={null} />);
    expect(screen.getByRole("link", { name: "Snapshot" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Trends" })).toBeTruthy();
    const select = screen.getByRole("combobox", { name: "Jump to profile section" }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["sec-a", "sec-b"]);
  });

  it("clicking a link scrolls the target into view and marks it active", () => {
    document.body.innerHTML = '<div id="sec-a"></div><div id="sec-b"></div>';
    const scrollIntoView = vi.fn();
    document.getElementById("sec-b")!.scrollIntoView = scrollIntoView;
    render(<ProfileSectionNav sections={SECTIONS} scrollRoot={document.body} />);
    fireEvent.click(screen.getByRole("link", { name: "Trends" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(screen.getByRole("link", { name: "Trends" }).getAttribute("aria-current")).toBe("true");
  });

  it("passes only fixed-px rootMargin, never percentages — a %-based margin on a non-document root silently never fires the callback in at least one real browser engine (found via live verification, not reproducible in jsdom)", () => {
    document.body.innerHTML = '<div id="sec-a"></div><div id="sec-b"></div>';
    let capturedMargin: string | undefined;
    class SpyObserver {
      constructor(_cb: unknown, opts?: IntersectionObserverInit) {
        capturedMargin = opts?.rootMargin;
      }
      observe() {}
      disconnect() {}
    }
    const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = SpyObserver;
    render(<ProfileSectionNav sections={SECTIONS} scrollRoot={document.body} />);
    expect(capturedMargin).toBeDefined();
    expect(capturedMargin).not.toMatch(/%/);
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
  });

  it("degrades gracefully with no IntersectionObserver (progressive enhancement)", () => {
    const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    // @ts-expect-error -- deliberately simulating an environment without it
    delete globalThis.IntersectionObserver;
    document.body.innerHTML = '<div id="sec-a"></div><div id="sec-b"></div>';
    expect(() => render(<ProfileSectionNav sections={SECTIONS} scrollRoot={document.body} />)).not.toThrow();
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
  });
});
