// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReportBody from "./ReportBody";

describe("ReportBody", () => {
  it("renders authored Markdown titles as subordinate paper headings", () => {
    render(<ReportBody report={"# Credit Review\n\nBody copy."} />);

    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Credit Review" })).toBeTruthy();
  });

  it("preserves explicit GFM numeric-column alignment without guessing from cell text", () => {
    render(<ReportBody report={"| Metric | Value |\n| --- | ---: |\n| Net leverage | 5.2x |"} />);

    expect(screen.getByRole("columnheader", { name: "Value" }).className).toContain("rdoc-num");
    expect(screen.getByRole("cell", { name: "5.2x" }).className).toContain("rdoc-num");
    expect(screen.getByRole("cell", { name: "Net leverage" }).className).not.toContain("rdoc-num");
  });
});
