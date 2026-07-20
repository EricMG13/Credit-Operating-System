// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/command" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

import ReportBody from "@/components/research/ReportBody";
import { AiModeToggle } from "./AiModeToggle";
import { FirstRunHint } from "./FirstRunHint";
import { RecoveryState } from "./RecoveryState";
import { RouteHeading } from "./RouteHeading";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  route.pathname = "/command";
});

describe("recovery and small shared surfaces", () => {
  it("renders preserved fallback authority and invokes recovery actions", () => {
    const retry = vi.fn();
    const escalate = vi.fn();
    render(
      <RecoveryState
        title="Data unavailable"
        detail="The live endpoint failed."
        preservedWork="Draft thesis"
        fallback={{ provenance: { origin: "REFERENCE", asOf: "old" }, approval: "DRAFT", asOf: "17 Jul" }}
        onRetry={retry}
        retryLabel="Try again"
        onEscalate={escalate}
        escalationLabel="Route to QA"
      />,
    );
    expect(screen.getByText("Preserved: Draft thesis")).toBeTruthy();
    expect(screen.getByLabelText(/Origin REFERENCE/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Route to QA" }));
    expect(retry).toHaveBeenCalled();
    expect(escalate).toHaveBeenCalled();

    cleanup();
    render(<RecoveryState title="Empty recovery" detail="No actions" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("persists, suppresses, and gracefully degrades first-run hints", async () => {
    const { rerender } = render(<FirstRunHint id="one" className="hint-class">Use the evidence rail.</FirstRunHint>);
    expect(await screen.findByText("Use the evidence rail.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    expect(localStorage.getItem("caos-hint-one")).toBe("1");
    expect(screen.queryByText("Use the evidence rail.")).toBeNull();

    rerender(<FirstRunHint id="one">Hidden</FirstRunHint>);
    await waitFor(() => expect(screen.queryByText("Hidden")).toBeNull());

    cleanup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("private"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("private"); });
    render(<FirstRunHint id="private">Private mode hint</FirstRunHint>);
    expect(await screen.findByText("Private mode hint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    expect(screen.queryByText("Private mode hint")).toBeNull();
  });

  it("switches AI presets and exposes the requested labels", () => {
    const change = vi.fn();
    render(<AiModeToggle value="standard" onChange={change} label="Research power" ariaLabel="Power selector" />);
    expect(screen.getByRole("group", { name: "Power selector" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /standard/i }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /max/i }));
    fireEvent.click(screen.getByRole("button", { name: /lite/i }));
    expect(change.mock.calls.map(([value]) => value)).toEqual(["max", "lite"]);
  });

  it("maps known, nested, null, and unknown routes to accessible headings", () => {
    const { rerender } = render(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Command Center");
    route.pathname = "/sector-rv/company";
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("RV Screener");
    route.pathname = "/portfolios";
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Portfolio Lab");
    route.pathname = "/decisions/decision-1";
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("IC Book");
    route.pathname = "/issuers/profile?issuer=issuer-1";
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Issuer Profile");
    route.pathname = "/settings/access";
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Settings");
    route.pathname = "/unknown";
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
    route.pathname = null;
    rerender(<RouteHeading />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CAOS");
  });

  it("renders GFM tables and safe external report links", () => {
    render(<ReportBody report={"| Metric | Value |\n|---|---|\n| Leverage | 5.0x |\n\n[Source](https://example.test)"} />);
    expect(screen.getByRole("table").parentElement?.className).toContain("rdoc-table-scroll");
    const link = screen.getByRole("link", { name: "Source" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });
});
