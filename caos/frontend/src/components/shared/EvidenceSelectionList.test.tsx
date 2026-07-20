// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useModalA11y } from "@/lib/use-modal-a11y";
import { EvidenceSelectionList, type EvidenceSelectionItem } from "./EvidenceSelectionList";

afterEach(cleanup);
beforeEach(() => callback.mockReset());

const callback = vi.fn();
const items: EvidenceSelectionItem[] = [
  { id: "E-1", label: "Debt agreement", description: "Section 4.09", status: "Verified", effect: { kind: "callback", onOpen: callback } },
  { id: "E-2", label: "Quarterly filing", description: "Page 31", status: "Open", effect: { kind: "callback", onOpen: callback } },
  { id: "E-3", label: "Market source", status: "Current", effect: { kind: "href", href: "/sources/E-3" } },
];

function Viewer({ onClose }: { onClose: () => void }) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label="Source viewer"><button onClick={onClose}>Close source</button></div>;
}

function FocusHarness() {
  const [open, setOpen] = useState(false);
  const viewerItems: EvidenceSelectionItem[] = [{
    id: "E-9",
    label: "Credit agreement",
    status: "Verified",
    effect: { kind: "callback", onOpen: () => setOpen(true) },
  }];
  return <>{<EvidenceSelectionList label="Evidence register" items={viewerItems} />}{open ? <Viewer onClose={() => setOpen(false)} /> : null}</>;
}

describe("EvidenceSelectionList", () => {
  it("keeps one selected row and one shared callback opener", () => {
    const { container } = render(<EvidenceSelectionList label="Evidence register" items={items.slice(0, 2)} />);
    const options = screen.getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[0].getAttribute("aria-posinset")).toBe("1");
    expect(options[0].getAttribute("aria-setsize")).toBe("2");
    expect(options[0].tabIndex).toBe(0);
    expect(options[1].tabIndex).toBe(-1);
    expect(screen.getAllByRole("button", { name: "Open source E-1 — Debt agreement" })).toHaveLength(1);
    expect(container.querySelectorAll('[role="option"] button, [role="option"] a')).toHaveLength(0);
    expect(screen.getByRole("listbox").hasAttribute("aria-activedescendant")).toBe(false);
    expect(options[0].id).toMatch(/-evidence-option-1$/);
    expect(options[0].id).not.toContain(items[0].id);

    fireEvent.click(screen.getByRole("button", { name: "Open source E-1 — Debt agreement" }));
    expect(callback).toHaveBeenCalledWith("E-1");

    fireEvent.click(options[1]);
    expect(screen.getByRole("button", { name: "Open source E-2 — Quarterly filing" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open source E-2 — Quarterly filing" }));
    expect(callback).toHaveBeenLastCalledWith("E-2");
  });

  it("uses Arrow Up/Down and Home/End as a stable roving selection", () => {
    render(<EvidenceSelectionList label="Evidence register" items={items} />);
    const options = screen.getAllByRole("option");
    const expectActive = (index: number) => {
      expect(document.activeElement).toBe(options[index]);
      expect(options[index].tabIndex).toBe(0);
      expect(options[index].getAttribute("aria-selected")).toBe("true");
      expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1);
      expect(options.filter((option) => option.getAttribute("aria-selected") === "true")).toHaveLength(1);
    };
    options[0].focus();
    fireEvent.keyDown(options[0], { key: "ArrowDown" });
    expectActive(1);
    fireEvent.keyDown(options[1], { key: "End" });
    expectActive(2);
    fireEvent.keyDown(options[2], { key: "Home" });
    expectActive(0);
    fireEvent.keyDown(options[0], { key: "ArrowUp" });
    expectActive(2);
  });

  it("changes the exact action name and effect when selection moves from callback to href", () => {
    render(<EvidenceSelectionList label="Evidence register" items={items} />);
    expect(screen.getByRole("button", { name: "Open source E-1 — Debt agreement" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /E-3/ }));
    const link = screen.getByRole("link", { name: "Open source E-3 — Market source" });
    expect(link.getAttribute("href")).toBe("/sources/E-3");
    expect(screen.queryByRole("button", { name: /Open source/ })).toBeNull();
  });

  it.each([
    { label: "blank", invalidItems: [{ ...items[0], id: "" }] },
    { label: "duplicate", invalidItems: [items[0], { ...items[1], id: "E-1" }] },
  ])("renders an honest invalid-register alert for $label source IDs", ({ invalidItems }) => {
    render(<EvidenceSelectionList label="Evidence register" items={invalidItems} />);
    expect(screen.getByRole("alert").textContent).toContain("Evidence register unavailable");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Open source/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Open source/ })).toBeNull();
  });

  it("restores focus to the shared opener when the source viewer closes", async () => {
    render(<FocusHarness />);
    const opener = screen.getByRole("button", { name: "Open source E-9 — Credit agreement" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(await screen.findByRole("button", { name: "Close source" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
