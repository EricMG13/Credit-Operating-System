// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DecisionHeader } from "./DecisionHeader";

afterEach(cleanup);

describe("DecisionHeader", () => {
  it("renders explicit decision-safe empty states instead of ambiguous no-data cells", () => {
    render(<DecisionHeader whatChanged="3 repricings" />);
    expect(screen.getByText("3 repricings")).toBeTruthy();
    expect(screen.getByText("Decision impact unavailable")).toBeTruthy();
    expect(screen.getByText("Required action unavailable")).toBeTruthy();
    expect(screen.getByText("Evidence state unavailable")).toBeTruthy();
  });

  it("renders a Provenance-shaped evidenceHealth cell as a grammar chip", () => {
    render(
      <DecisionHeader
        evidenceHealth={{ origin: "LIVE", freshness: "STALE", detail: "3 stale of 12" }}
      />,
    );
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByText("STALE")).toBeTruthy();
  });

  it("opens decision context for every persona and allows an explicit collapse", () => {
    render(<DecisionHeader whatChanged="x" />);
    const btn = screen.getByRole("button", { expanded: true });
    expect(screen.getByText("x")).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByRole("button", { expanded: false })).toBeTruthy();
    expect(screen.queryByText("x")).toBeNull();
  });

  it("lets editor surfaces default closed without removing the decision context", () => {
    render(<DecisionHeader defaultOpen={false} whatChanged="Model downside changed" />);
    const btn = screen.getByRole("button", { expanded: false });
    expect(screen.queryByText("Model downside changed")).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText("Model downside changed")).toBeTruthy();
  });

  it("renders one shared observation envelope when every conclusion has identical authority", () => {
    const authority = {
      provenance: { origin: "LIVE" as const, method: "DERIVED" as const, freshness: "CURRENT" as const },
      approval: "UNRATIFIED" as const,
    };
    render(<DecisionHeader state={{
      whatChanged: { kind: "ready", value: "A", asOf: "13 Jul 2026, 09:00", authority },
      whyItMatters: { kind: "ready", value: "B", asOf: "13 Jul 2026, 09:00", authority },
      requiredAction: { kind: "ready", value: "C", asOf: "13 Jul 2026, 09:00", authority },
      evidenceHealth: { kind: "ready", value: "D", asOf: "13 Jul 2026, 09:00", authority },
    }} />);
    expect(screen.getAllByText(/as of 13 Jul 2026, 09:00/)).toHaveLength(1);
    expect(screen.getAllByText("LIVE")).toHaveLength(1);
    expect(screen.getByLabelText("Shared authority for all decision conclusions")).toBeTruthy();
  });

  it("reserves no-material-change language for an explicit timestamped observation", () => {
    render(<DecisionHeader state={{
      whatChanged: { kind: "observed-empty", asOf: "13 Jul 2026, 09:00", message: "No material change observed" },
      whyItMatters: { kind: "ready", value: "Posture unchanged", asOf: "13 Jul 2026, 09:00" },
      requiredAction: { kind: "observed-empty", asOf: "13 Jul 2026, 09:00", message: "No action required" },
      evidenceHealth: { kind: "ready", value: "All sources current", asOf: "13 Jul 2026, 09:00" },
    }} />);
    expect(screen.getByText("No material change observed")).toBeTruthy();
    expect(screen.getAllByText(/as of 13 Jul 2026, 09:00/)).toHaveLength(4);
  });

  it("renders a failed response as an error, never as a neutral empty observation", () => {
    render(<DecisionHeader state={{
      whatChanged: { kind: "error", message: "Observation failed" },
      whyItMatters: { kind: "unavailable" },
      requiredAction: { kind: "unavailable" },
      evidenceHealth: { kind: "offline", lastKnown: "Source offline" },
    }} />);
    expect(screen.getByRole("alert").textContent).toContain("Observation failed");
    expect(screen.queryByText(/No material change/)).toBeNull();
  });
});
