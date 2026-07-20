// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutSection } from "@/lib/deepdive/module-outputs";
import { OutSections } from "./OutSections";

let resizeCallback: ResizeObserverCallback | null = null;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  resizeCallback = null;
  vi.unstubAllGlobals();
});

describe("OutSections live disclosure", () => {
  it("renders empty sections safely and exposes only declared evidence actions", () => {
    const openEvidence = vi.fn();
    const view = render(<OutSections sections={[]} onOpenEvidence={openEvidence} />);
    expect(view.container.children).toHaveLength(0);

    view.rerender(<OutSections sections={[{
      type: "text",
      title: "Live conclusion",
      body: "No citation was persisted.",
    } as OutSection]} onOpenEvidence={openEvidence} />);
    expect(screen.queryByRole("button")).toBeNull();

    view.rerender(<OutSections sections={[{
      type: "text",
      title: "Cited conclusion",
      body: "Persisted conclusion.",
      ev: ["E-LIVE-1"],
    } as OutSection]} onOpenEvidence={openEvidence} />);
    fireEvent.click(screen.getByRole("button", { name: "Open source for E-LIVE-1" }));
    expect(openEvidence).toHaveBeenCalledWith("E-LIVE-1");
  });

  it("expands the exact retained table rows in place through a native button", () => {
    const rows = Array.from({ length: 12 }, (_, index) => [`row ${index + 1}`, String(index + 1)]);
    const sections = [{
      type: "table",
      title: "Live measures",
      cols: ["Metric", "Value"],
      align: [0, 1],
      rows,
      overflowRows: [["row 13", "13"], ["row 14", "14"]],
    }] as unknown as OutSection[];

    render(<OutSections sections={sections} onOpenEvidence={() => {}} />);
    const more = screen.getByRole("button", { name: "+2 more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("row 13")).toBeNull();

    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("row 13")).toBeTruthy();
    expect(screen.getByText("row 14")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.queryByText("row 13")).toBeNull();
  });

  it("uses the same exact-count disclosure for persisted flag items", () => {
    const sections = [{
      type: "flags",
      title: "Live flags",
      items: [{ sev: "warning", text: "Initial flag" }],
      overflowItems: [{ sev: "critical", text: "Retained adverse flag" }],
    }] as unknown as OutSection[];

    render(<OutSections sections={sections} onOpenEvidence={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 more" }));
    expect(screen.getByText("Retained adverse flag")).toBeTruthy();
  });

  it("names and focuses a table scroll owner only while it genuinely overflows", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    const sections = [{
      type: "table",
      title: "Capacity register",
      cols: ["Metric", "Value"],
      rows: [["Debt", "$100m"]],
    }] as unknown as OutSection[];
    const { container } = render(<OutSections sections={sections} onOpenEvidence={() => {}} />);
    const owner = container.querySelector<HTMLElement>(".deepdive-output-table-scroll")!;
    Object.defineProperty(owner, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(owner, "scrollWidth", { configurable: true, value: 800 });

    act(() => resizeCallback?.([], {} as ResizeObserver));
    expect(owner.tabIndex).toBe(0);
    expect(owner.getAttribute("aria-label")).toBe("Capacity register table");

    Object.defineProperty(owner, "scrollWidth", { configurable: true, value: 400 });
    act(() => resizeCallback?.([], {} as ResizeObserver));
    expect(owner.getAttribute("tabindex")).toBeNull();
    expect(owner.getAttribute("aria-label")).toBeNull();
  });
});
