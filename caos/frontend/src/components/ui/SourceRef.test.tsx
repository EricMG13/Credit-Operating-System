// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SourceRef } from "./SourceRef";

afterEach(cleanup);

describe("SourceRef", () => {
  it("renders a persisted id as a real source link only when it has a destination", () => {
    render(<SourceRef source={{ state: "ready", id: "chunk-17", href: "/deep-dive?chunk=chunk-17" }}>Open source</SourceRef>);

    const link = screen.getByRole("link", { name: "Open source chunk-17" });
    expect(link.getAttribute("href")).toBe("/deep-dive?chunk=chunk-17");
  });

  it("preserves a valid absolute web source destination", () => {
    render(<SourceRef source={{ state: "ready", id: "filing-17", href: "https://www.sec.gov/Archives/filing.htm" }} />);

    expect(screen.getByRole("link", { name: "Open source filing-17" }).getAttribute("href"))
      .toBe("https://www.sec.gov/Archives/filing.htm");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//attacker.example/source",
    "\\\\attacker.example/source",
    " https://attacker.example/source",
    "https://analyst:secret@example.com/source",
    "https://example.com/source with space",
  ])("fails closed for an unsafe source destination: %s", (href) => {
    render(<SourceRef source={{ state: "ready", id: "unsafe-17", href }} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Source unavailable · Source unsafe-17 has an invalid destination.")).toBeTruthy();
  });

  it("supports a persisted id with a real local action", () => {
    const onOpen = vi.fn();
    render(<SourceRef source={{ state: "ready", id: "E-17", onOpen }}>Open evidence</SourceRef>);

    fireEvent.click(screen.getByRole("button", { name: "Open source E-17" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("renders unavailable provenance as explanatory text, not an inert link", () => {
    render(<SourceRef source={{ state: "unavailable", reason: "Source E-17 has no persisted route." }} />);

    expect(screen.getByText("Source unavailable · Source E-17 has no persisted route.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
