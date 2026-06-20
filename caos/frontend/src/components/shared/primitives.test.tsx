// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { StatCard } from "./StatCard";
import { SectionHeader } from "./SectionHeader";
import { StatusGlyph } from "./StatusGlyph";
import { RailShell } from "./RailShell";
import { FlashOnChange } from "./FlashOnChange";
import { ScopeToggle } from "./ScopeToggle";

afterEach(cleanup);

// jsdom doesn't reliably parse modern CSS values (var()/color-mix) on inline
// styles, so these assert structure/behavior; the sevSurface tint *logic* is
// unit-tested in lib/pipeline/sim.test.ts.

describe("StatCard", () => {
  it("renders value, label and sub; the value carries a title and the metric size", () => {
    render(<StatCard value="7.2 / 10" label="Aggressiveness" sub="vs norm 6.1" />);
    const value = screen.getByText("7.2 / 10");
    expect(screen.getByText("Aggressiveness")).toBeTruthy();
    expect(screen.getByText("vs norm 6.1")).toBeTruthy();
    expect(value.getAttribute("title")).toBe("7.2 / 10");
    expect(value.className).toContain("text-caos-metric");
  });

  it("uses the hero size when asked", () => {
    render(<StatCard value="3" label="Critical" size="hero" />);
    expect(screen.getByText("3").className).toContain("text-caos-hero");
  });
});

describe("SectionHeader", () => {
  it("renders the title and optional right-aligned meta", () => {
    render(<SectionHeader title="CP-3B-02 · Capital structure" right="claims: 1L $1,970" />);
    expect(screen.getByText("CP-3B-02 · Capital structure")).toBeTruthy();
    expect(screen.getByText("claims: 1L $1,970")).toBeTruthy();
  });
});

describe("StatusGlyph", () => {
  it("renders a decorative (aria-hidden) lock svg for kind=locked", () => {
    const { container } = render(<StatusGlyph kind="locked" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("RailShell", () => {
  it("renders children when open and hides the collapsed strip", () => {
    render(
      <RailShell open onToggle={() => {}} collapsed={<span>strip</span>}>
        <div>panel content</div>
      </RailShell>
    );
    expect(screen.getByText("panel content")).toBeTruthy();
    expect(screen.queryByText("strip")).toBeNull();
  });

  it("when collapsed, shows the labelled expand toggle + collapsed content, not children", () => {
    const onToggle = vi.fn();
    render(
      <RailShell open={false} onToggle={onToggle} expandTitle="Expand source rail" collapsed={<span>strip</span>}>
        <div>panel content</div>
      </RailShell>
    );
    expect(screen.queryByText("panel content")).toBeNull();
    expect(screen.getByText("strip")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand source rail" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("ScopeToggle", () => {
  it("marks the selected scope pressed and emits the other on click", () => {
    const onChange = vi.fn();
    render(<ScopeToggle value="sector" onChange={onChange} label="Scope" />);
    expect(screen.getByRole("button", { name: "sector" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "issuer" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "issuer" }));
    expect(onChange).toHaveBeenCalledWith("issuer");
  });
});

describe("FlashOnChange", () => {
  it("flashes only when the value changes, then clears", () => {
    vi.useFakeTimers();
    try {
      const { rerender, container } = render(<FlashOnChange value={1}>v</FlashOnChange>);
      const span = () => container.querySelector("span") as HTMLElement;
      expect(span().className).not.toContain("caos-flash"); // initial render: no flash

      rerender(<FlashOnChange value={2}>v</FlashOnChange>);
      expect(span().className).toContain("caos-flash"); // value changed → flashing

      act(() => { vi.advanceTimersByTime(600); });
      expect(span().className).not.toContain("caos-flash"); // flash cleared
    } finally {
      vi.useRealTimers();
    }
  });
});
