// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Bar, Dot, SimControls, Tag, ToggleGroup } from "./atoms";
import type { SimRun } from "@/lib/pipeline/sim";

afterEach(cleanup);

function run(overrides: Partial<SimRun> = {}): SimRun {
  return {
    sim: { done: false } as SimRun["sim"],
    playing: false,
    setPlaying: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    reset: vi.fn(),
    clock: "09:30",
    completed: 0,
    total: 1,
    ...overrides,
  };
}

describe("pipeline atoms", () => {
  it("pipeline-43 renders dot and glyph variants with safe severity fallbacks", () => {
    const { container, rerender } = render(<Dot />);
    expect((container.firstElementChild as HTMLElement).style.background).toBe("var(--caos-idle)");

    rerender(<Dot sev="critical" glyph pulse />);
    expect(container.firstElementChild?.className).toContain("caos-running");
    expect(container.querySelector("svg")).toBeTruthy();

    rerender(<Dot sev="not-a-severity" glyph />);
    expect((container.firstElementChild as HTMLElement).style.color).toBe("var(--caos-idle)");
  });

  it("renders active and idle tags", () => {
    const { rerender } = render(<Tag sev="warning">WATCH</Tag>);
    expect(screen.getByText("WATCH").style.color).toBe("var(--caos-warning)");
    rerender(<Tag sev="queued">QUEUED</Tag>);
    expect(screen.getByText("QUEUED").style.color).toBe("var(--caos-muted)");
    rerender(<Tag>IDLE</Tag>);
    expect(screen.getByText("IDLE").style.color).toBe("var(--caos-muted)");
  });

  it.each([
    [120, 4, "100%", "4px"],
    [-2, -1, "0%", "3px"],
    [Number.NaN, Number.NaN, "0%", "3px"],
    [Number.POSITIVE_INFINITY, 2, "0%", "2px"],
  ])("clamps unsafe bar dimensions %#", (pct, h, width, height) => {
    const { container } = render(<Bar pct={pct} h={h} />);
    expect((container.firstElementChild as HTMLElement).style.height).toBe(height);
    expect((container.firstElementChild?.firstElementChild as HTMLElement).style.width).toBe(width);
  });

  it("handles both toggle sizes, titles, boolean keys, and invalid options", () => {
    const onChange = vi.fn();
    const { rerender, container } = render(
      <ToggleGroup
        options={[{ k: true, l: "LIVE", title: "Use live data" }, { k: false, l: "DEMO" }]}
        value={true}
        onChange={onChange}
        size="sm"
        className="extra"
      />,
    );
    expect(screen.getByRole("group").className).toContain("extra");
    expect(screen.getByRole("button", { name: "Use live data" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "DEMO" }));
    expect(onChange).toHaveBeenCalledWith(false);

    rerender(<ToggleGroup options={[{ k: "a", l: "A" }]} value="a" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "A" }).className).toContain("px-3");
    rerender(<ToggleGroup options={null as never} value="a" onChange={onChange} />);
    expect(container.children).toHaveLength(0);
  });

  it("pipeline-17 plays, pauses, resets, changes speed, and replays completed simulations", () => {
    const idle = run();
    const { rerender } = render(<SimControls run={idle} />);
    fireEvent.click(screen.getByRole("button", { name: "Play simulation" }));
    expect(idle.setPlaying).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset run" }));
    expect(idle.reset).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Speed 4x" }));
    expect(idle.setSpeed).toHaveBeenCalledWith(4);

    const playing = run({ playing: true, speed: 2 });
    rerender(<SimControls run={playing} />);
    expect(screen.getByRole("button", { name: "Speed 2x" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(playing.setPlaying).toHaveBeenCalledWith(false);

    const done = run({ playing: true, sim: { done: true } as SimRun["sim"] });
    rerender(<SimControls run={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Replay simulation" }));
    expect(done.reset).toHaveBeenCalled();
  });

  it("renders nothing without a runnable simulation", () => {
    const { container, rerender } = render(<SimControls />);
    expect(container.children).toHaveLength(0);
    rerender(<SimControls run={{} as SimRun} />);
    expect(container.children).toHaveLength(0);
  });
});
