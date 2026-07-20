// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DataModeMarker, OpenReferenceExample } from "./DataMode";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/research");
});

describe("shared data mode presentation", () => {
  it("renders no marker in live mode", () => {
    window.history.replaceState({}, "", "/research?context=ctx");
    render(<DataModeMarker />);
    expect(screen.queryByText("REFERENCE · seeded, not issuer data")).toBeNull();
  });

  it("renders the exact persistent marker in reference mode", () => {
    window.history.replaceState({}, "", "/research?context=ctx&mode=reference");
    render(<DataModeMarker />);
    const marker = screen.getByRole("status");
    expect(marker.textContent).toBe("REFERENCE · seeded, not issuer data");
    expect(marker.classList.contains("hidden")).toBe(false);
  });

  it("opens a real reference URL while preserving route context and hash", () => {
    window.history.replaceState({}, "", "/deepdive?issuer=iss-1&run=run-2&context=ctx#E-1");
    render(<OpenReferenceExample />);
    expect(screen.getByRole("link", { name: "Open reference example" }).getAttribute("href"))
      .toBe("/deepdive?issuer=iss-1&run=run-2&context=ctx&mode=reference#E-1");
  });
});
