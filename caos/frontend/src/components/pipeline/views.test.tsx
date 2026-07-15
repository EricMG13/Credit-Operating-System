// @vitest-environment jsdom
//
// Coverage scaffold for the Pipeline Visualizer views — the 4 complex,
// previously-untested presentational components flagged by `fallow health`
// (GraphView / SwimlaneView / Inspector / LineagePanel) plus EventLog. These
// are pure prop-driven renders over the real pipeline fixtures; each test
// pins one meaningful branch so a regression in the render logic fails here.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GraphView, SwimlaneView, Inspector, LineagePanel, EventLog } from "./views";
import { MODULES } from "@/lib/pipeline/data";
import type { Sim } from "@/lib/pipeline/sim-engine";

const emptySim: Sim = { mods: {}, events: [], tick: 0, done: false };
const fullScope = () => new Set(MODULES.map((m) => m.id));

afterEach(cleanup);

describe("EventLog", () => {
  it("shows the awaiting-start placeholder when empty", () => {
    render(<EventLog events={[]} />);
    expect(screen.getByText("Awaiting run start…")).toBeTruthy();
  });

  it("renders each event's time and text", () => {
    render(<EventLog events={[{ t: "00:01", sev: "running", text: "CP-1 started" }]} />);
    expect(screen.getByText("CP-1 started")).toBeTruthy();
    expect(screen.getByText("00:01")).toBeTruthy();
    expect(screen.queryByText("Awaiting run start…")).toBeNull();
  });
});

describe("LineagePanel", () => {
  it("renders every driver when the filter is null", () => {
    render(<LineagePanel onPick={() => {}} drivers={null} onOpenEvidence={() => {}} />);
    expect(screen.getByText(/EBITDA quality/)).toBeTruthy();
    expect(screen.getByText(/Customer concentration/)).toBeTruthy();
  });

  it("filters to the listed driver numbers", () => {
    render(<LineagePanel onPick={() => {}} drivers={[1]} onOpenEvidence={() => {}} />);
    expect(screen.getByText(/EBITDA quality/)).toBeTruthy();
    expect(screen.queryByText(/Customer concentration/)).toBeNull();
  });

  it("calls onPick with the clicked driver", () => {
    const onPick = vi.fn();
    render(<LineagePanel onPick={onPick} drivers={[1]} onOpenEvidence={() => {}} />);
    fireEvent.click(screen.getByText(/EBITDA quality/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ n: 1 }));
  });
});

describe("Inspector", () => {
  it("prompts to select a module when nothing is selected", () => {
    render(<Inspector sim={emptySim} selected={null} plan={[]} scope={new Set()} modeLabel="full-committee" />);
    expect(screen.getByText("Module Inspector")).toBeTruthy();
  });

  it("renders the module detail and its in-scope QA finding", () => {
    // CP-1C carries a NODE_QA entry (QA-117); a 'warning' state keeps it in the
    // degraded branch so the QA panel must render.
    const sim: Sim = { mods: { "CP-1C": { state: "warning", prog: 1 } }, events: [], tick: 0, done: false };
    render(<Inspector sim={sim} selected="CP-1C" plan={[]} scope={new Set(["CP-1C"])} modeLabel="full-committee" />);
    expect(screen.getByText("Peer Benchmarking")).toBeTruthy(); // MODULES[CP-1C].name
    expect(screen.getByText("QA-117")).toBeTruthy();
    expect(screen.getByText(/Citation E-44 unresolved/)).toBeTruthy();
  });

  it("marks an out-of-scope module as skipped by the route", () => {
    render(<Inspector sim={emptySim} selected="CP-1C" plan={[]} scope={new Set()} modeLabel="legal-only" />);
    expect(screen.getByText(/Out of scope for the legal-only route/)).toBeTruthy();
  });

  it("suppresses the seeded ATLF QA finding under a live run (isLive)", () => {
    // Same CP-1C warning state as above, but on a LIVE run the seeded QA fixture
    // must NOT render as if it belonged to this run. (#4 seeded-under-live)
    const sim: Sim = { mods: { "CP-1C": { state: "warning", prog: 1 } }, events: [], tick: 0, done: false };
    render(<Inspector sim={sim} selected="CP-1C" plan={[]} scope={new Set(["CP-1C"])} modeLabel="LIVE" isLive />);
    expect(screen.getByText("Peer Benchmarking")).toBeTruthy(); // module still renders
    expect(screen.queryByText("QA-117")).toBeNull();            // seeded QA hidden
    expect(screen.queryByText(/Citation E-44 unresolved/)).toBeNull();
  });
});

describe("GraphView", () => {
  it("renders one node button per module and toggles selection on click", () => {
    const onSelect = vi.fn();
    render(<GraphView sim={emptySim} selected={null} onSelect={onSelect} dim={false} scope={fullScope()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(MODULES.length);
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith(MODULES[0].id);
    expect(screen.getByRole("region", { name: /scroll horizontally/i })).toBeTruthy();
  });

  // Regression for matrix 2.1: `SEV_COLOR[st] + "66"` emitted `var(--caos-…)66`
  // (invalid CSS, silently dropped) — every colored node lost its status border.
  it("gives a non-idle node a valid mixed border color, not a var+alpha concat", () => {
    const sim: Sim = { mods: { [MODULES[0].id]: { state: "warning", prog: 0.5 } }, events: [], tick: 1, done: false };
    render(<GraphView sim={sim} selected={null} onSelect={() => {}} dim={false} scope={fullScope()} />);
    const style = screen.getAllByRole("button")[0].getAttribute("style") || "";
    expect(style).toContain("color-mix");
    expect(style).not.toMatch(/var\(--[a-z-]+\)\s*(0d|11|14|22|33|55|66)/);
  });
});

describe("SwimlaneView", () => {
  it("labels in-scope idle modules as queued", () => {
    render(<SwimlaneView sim={emptySim} selected={null} onSelect={() => {}} scope={fullScope()} />);
    expect(screen.getAllByText("queued").length).toBeGreaterThan(0);
  });

  it("labels out-of-scope modules as skipped", () => {
    render(<SwimlaneView sim={emptySim} selected={null} onSelect={() => {}} scope={new Set()} />);
    expect(screen.getAllByText("skip").length).toBeGreaterThan(0);
  });
});
