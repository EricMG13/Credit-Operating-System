// CSS↔JS breakpoint contract. Media queries can't read JS constants, so the
// rail/compact-nav cutoffs in globals.css are hand-written — this test pins
// them to BP_WIDE so the 1180-vs-1280 split band (2026-07-15 critique P0)
// can never silently reopen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BP_COMPACT_SQUEEZE, BP_TABLET, BP_WIDE } from "./useBreakpoint";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

describe("shell breakpoint contract (globals.css ↔ useBreakpoint)", () => {
  it("shows the workflow rail exactly from BP_WIDE up", () => {
    expect(css).toContain(`@media (min-width: ${BP_WIDE}px) {`);
  });

  it("shows compact nav exactly below BP_WIDE and hides chips below tablet", () => {
    expect(css).toContain(`@media (max-width: ${BP_WIDE - 1}px)`);
    expect(css).toContain(`@media (max-width: ${BP_TABLET - 1}px)`);
    expect(css).toContain(".caos-concept-chips { display: none; }");
  });

  it("collapses the inline View toggle exactly below the squeeze cutoff", () => {
    expect(css).toContain(`@media (max-width: ${BP_COMPACT_SQUEEZE - 1}px)`);
    expect(css).toContain(".caos-compact-view { display: none; }");
  });

  it("retires the old 1180px rail cutoff entirely", () => {
    expect(css).not.toMatch(/1180px|1179px/);
  });
});
