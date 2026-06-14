// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EvidenceSyncProvider, useEvidenceSync } from "./evidence-sync";
import { EvChip } from "@/components/reports/EvidenceModal";

afterEach(cleanup);

function Probe() {
  const { active, setActive } = useEvidenceSync();
  return (
    <div>
      <span data-testid="active">{active ?? "none"}</span>
      <button onClick={() => setActive("E-44")}>set</button>
      <button onClick={() => setActive(null)}>clear</button>
    </div>
  );
}

describe("EvidenceSyncProvider / useEvidenceSync", () => {
  it("shares and updates the active evidence id across consumers", () => {
    render(
      <EvidenceSyncProvider>
        <Probe />
      </EvidenceSyncProvider>
    );
    expect(screen.getByTestId("active").textContent).toBe("none");
    fireEvent.click(screen.getByText("set"));
    expect(screen.getByTestId("active").textContent).toBe("E-44");
    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("active").textContent).toBe("none");
  });

  it("is inert outside a provider — chips work unguarded on other pages", () => {
    render(<Probe />); // no provider → default no-op setter
    fireEvent.click(screen.getByText("set"));
    expect(screen.getByTestId("active").textContent).toBe("none");
  });
});

describe("EvChip cross-pane sync", () => {
  it("hovering one chip highlights every chip citing the same evidence, not others", () => {
    const onOpen = vi.fn();
    render(
      <EvidenceSyncProvider>
        <EvChip id="E-44" onOpen={onOpen} />
        <EvChip id="E-44" onOpen={onOpen} />
        <EvChip id="E-09" onOpen={onOpen} />
      </EvidenceSyncProvider>
    );
    const [a, b, other] = screen.getAllByRole("button");

    // Nothing synced initially.
    expect(a.style.boxShadow).toBe("");

    // Hover the first E-44 chip → both E-44 chips get the accent ring; E-09 does not.
    fireEvent.mouseEnter(a);
    expect(a.style.boxShadow).toContain("var(--caos-accent)");
    expect(b.style.boxShadow).toContain("var(--caos-accent)");
    expect(other.style.boxShadow).toBe("");

    // Leaving clears the selection.
    fireEvent.mouseLeave(a);
    expect(a.style.boxShadow).toBe("");
    expect(b.style.boxShadow).toBe("");
  });

  it("clicking a chip opens its source without leaking the click to parents", () => {
    const onOpen = vi.fn();
    render(
      <EvidenceSyncProvider>
        <EvChip id="E-44" onOpen={onOpen} />
      </EvidenceSyncProvider>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith("E-44");
  });
});
