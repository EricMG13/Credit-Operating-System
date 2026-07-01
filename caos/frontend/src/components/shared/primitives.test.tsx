// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { StatCard } from "./StatCard";
import { Panel } from "./Panel";
import { SectionHeader } from "./SectionHeader";
import { StatusGlyph } from "./StatusGlyph";
import { RailShell } from "./RailShell";
import { FlashOnChange } from "./FlashOnChange";
import { ScopeToggle } from "./ScopeToggle";
import { FilterHeader } from "./TableColumnFilter";

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

describe("FilterHeader", () => {
  it("opens from the visible filter button and closes on outside pointerdown", () => {
    render(
      <div>
        <FilterHeader
          label="Sector"
          col="sector"
          rows={[{ sector: "Telecom" }]}
          getValue={(row) => row.sector}
          selected={undefined}
          onChange={() => {}}
        >
          Sector
        </FilterHeader>
        <button type="button">outside</button>
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    expect(screen.getByRole("dialog", { name: "Filter Sector" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search Sector values"), { target: { value: "missing" } });
    expect(screen.getByText("No values")).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("dialog", { name: "Filter Sector" })).toBeNull();
  });

  it("caps large option lists and preserves the full value in a title", () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      sector: `Very long sector option ${String(i).padStart(3, "0")} with extra credit wording`,
    }));

    render(
      <FilterHeader
        label="Sector"
        col="sector"
        rows={rows}
        getValue={(row) => row.sector}
        selected={undefined}
        onChange={() => {}}
      >
        Sector
      </FilterHeader>
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(100);
    expect(screen.getByText("Showing first 100 of 101 values")).toBeTruthy();
    expect(screen.getByText(rows[0].sector).getAttribute("title")).toBe(rows[0].sector);
  });

  it("handles Clear and All actions correctly", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterHeader
        label="Sector"
        col="sector"
        rows={[{ sector: "Telecom" }, { sector: "Tech" }]}
        getValue={(row) => row.sector}
        selected={undefined}
        onChange={onChange}
      >
        Sector
      </FilterHeader>
    );

    // Open filter dialog
    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    
    // Default/undefined selected state should check all checkboxes
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);

    // Clicking Clear should call onChange with []
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("sector", []);

    // Rerender with selected={[]} (active but empty)
    rerender(
      <FilterHeader
        label="Sector"
        col="sector"
        rows={[{ sector: "Telecom" }, { sector: "Tech" }]}
        getValue={(row) => row.sector}
        selected={[]}
        onChange={onChange}
      >
        Sector
      </FilterHeader>
    );

    // Checkboxes should be unchecked
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);

    // Clicking All should call onChange with undefined
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith("sector", undefined);
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

describe("Panel", () => {
  it("renders title, children and right content by default", () => {
    render(
      <Panel title="Test Panel" right={<span>Right Content</span>}>
        <div>Body Content</div>
      </Panel>
    );
    expect(screen.getByText("Test Panel")).toBeTruthy();
    expect(screen.getByText("Right Content")).toBeTruthy();
    expect(screen.getByText("Body Content")).toBeTruthy();
  });

  it("does not render body when defaultCollapsed is true", () => {
    render(
      <Panel title="Collapsed Panel" collapsible defaultCollapsed>
        <div>Hidden Body</div>
      </Panel>
    );
    expect(screen.getByText("Collapsed Panel")).toBeTruthy();
    expect(screen.queryByText("Hidden Body")).toBeNull();
  });

  it("toggles body visibility when the collapse button is clicked", () => {
    render(
      <Panel title="Toggling Panel" collapsible>
        <div>Toggle Body</div>
      </Panel>
    );
    expect(screen.getByText("Toggle Body")).toBeTruthy();

    const collapseButton = screen.getByRole("button", { name: "Collapse Toggling Panel panel" });
    fireEvent.click(collapseButton);

    expect(screen.queryByText("Toggle Body")).toBeNull();

    const expandButton = screen.getByRole("button", { name: "Expand Toggling Panel panel" });
    fireEvent.click(expandButton);

    expect(screen.getByText("Toggle Body")).toBeTruthy();
  });
});
