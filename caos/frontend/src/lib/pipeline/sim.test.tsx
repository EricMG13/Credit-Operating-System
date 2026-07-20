// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanStep } from "./data";
import { planCounts, type SimRun, useSharedDayRun, useSimRun } from "./sim";

const singleStep: PlanStep[] = [{
  id: "CP-0",
  deps: [],
  dur: 1,
  outcome: "pass",
  event: "complete",
}];

let latestRun: SimRun | null = null;

function LocalProbe({
  plan,
  autoplay = true,
  prefill = false,
}: {
  plan: PlanStep[];
  autoplay?: boolean;
  prefill?: boolean;
}) {
  latestRun = useSimRun({ plan, autoplay, prefill, tickMs: 650 });
  return <output data-tick={latestRun.sim.tick} data-playing={latestRun.playing} />;
}

function SharedProbe() {
  latestRun = useSharedDayRun();
  return <output data-tick={latestRun.sim.tick} data-playing={latestRun.playing} />;
}

function run(): SimRun {
  if (!latestRun) throw new Error("simulation hook did not render");
  return latestRun;
}

beforeEach(() => {
  vi.useFakeTimers();
  latestRun = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSimRun", () => {
  it("reports zero completed modules when no simulation state is supplied", () => {
    expect(planCounts(singleStep)).toEqual({ total: 1, completed: 0 });
  });

  it("prefills to completion, resets, and reinitializes when the plan identity changes", async () => {
    const view = render(<LocalProbe plan={singleStep} prefill />);
    expect(run().sim.done).toBe(true);
    expect(run().playing).toBe(false);
    expect(run().completed).toBe(1);

    act(() => run().reset());
    expect(run().sim.done).toBe(false);
    expect(run().playing).toBe(true);

    const replacement: PlanStep[] = [
      { ...singleStep[0], id: "CP-1" },
      { ...singleStep[0], id: "CP-2", outcome: "warning" },
    ];
    view.rerender(<LocalProbe plan={replacement} autoplay={false} />);
    await act(async () => undefined);
    expect(run().total).toBe(2);
    expect(run().sim.tick).toBe(0);
    expect(run().playing).toBe(false);

    view.rerender(<LocalProbe plan={[...replacement]} autoplay />);
    await act(async () => undefined);
    expect(run().playing).toBe(true);
  });

  it("advances only while playing and honors speed changes", async () => {
    render(<LocalProbe plan={singleStep} autoplay={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_300); });
    expect(run().sim.tick).toBe(0);

    act(() => {
      run().setSpeed(2);
      run().setPlaying(true);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(run().sim.tick).toBeGreaterThan(0);
    expect(run().sim.done).toBe(true);

    const completedTick = run().sim.tick;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_300); });
    expect(run().sim.tick).toBe(completedTick);
  });

  it("clears an active local interval when its subscriber unmounts", async () => {
    const longPlan = [{ ...singleStep[0], dur: 100 }];
    const view = render(<LocalProbe plan={longPlan} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(run().sim.done).toBe(false);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  });
});

describe("useSharedDayRun", () => {
  it("shares play, speed, reset, timer completion, and subscriber cleanup", async () => {
    const view = render(<SharedProbe />);

    act(() => run().setPlaying(false));
    const pausedTick = run().sim.tick;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_300); });
    expect(run().sim.tick).toBe(pausedTick);

    act(() => {
      run().setSpeed(2);
      run().setPlaying(true);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(run().sim.tick).toBeGreaterThan(pausedTick);

    act(() => run().reset());
    expect(run().sim.tick).toBe(0);
    expect(run().playing).toBe(true);
    expect(run().speed).toBe(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(650 * 250); });
    expect(run().sim.done).toBe(true);
    expect(run().completed).toBe(run().total);

    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_300); });
  });
});
