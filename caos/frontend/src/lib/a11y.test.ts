import { describe, it, expect, vi } from "vitest";
import type { KeyboardEvent } from "react";
import { onActivate } from "./a11y";

function keyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

describe("onActivate", () => {
  it("fires the handler and prevents default on Enter and Space", () => {
    for (const key of ["Enter", " "]) {
      const fn = vi.fn();
      const e = keyEvent(key);
      onActivate(fn)(e);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(e.preventDefault).toHaveBeenCalledTimes(1);
    }
  });

  it("ignores other keys (no activation, no preventDefault)", () => {
    const fn = vi.fn();
    const e = keyEvent("Tab");
    onActivate(fn)(e);
    expect(fn).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
