// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OutSection } from "@/lib/deepdive/module-outputs";
import { OutSections } from "./OutSections";

describe("OutSections live disclosure", () => {
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
});
