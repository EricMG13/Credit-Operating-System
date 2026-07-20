// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { ConceptNav } from "./ConceptNav";
import { CONCEPT_CYCLE, NAV_GROUPS } from "@/lib/nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/monitor" }));
vi.mock("./AnalystBadge", () => ({ AnalystBadge: () => null }));
vi.mock("./RoleViewSwitch", () => ({ RoleViewSwitch: () => null }));
vi.mock("./AskShell", () => ({ AskUtility: () => <button type="button" aria-label="Ask CAOS">Ask</button> }));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/monitor");
});

describe("ConceptNav compact — Concepts drawer (guaranteed nav path)", () => {
  it("pipeline-13 pipeline-35 exposes a Concepts trigger that lists every concept with its full label", () => {
    render(<ConceptNav compact />);
    fireEvent.click(screen.getByRole("button", { name: /open workflows/i }));
    const drawer = screen.getByRole("dialog", { name: "Workflows" });
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const link = within(drawer).getByRole("link", { name: item.label });
        expect(link.getAttribute("href")).toBe(item.href);
      }
    }
    expect(within(drawer).getByRole("link", { name: "Settings" })).toBeTruthy();
  });

  it("marks the active route with aria-current inside the drawer", () => {
    render(<ConceptNav compact />);
    fireEvent.click(screen.getByRole("button", { name: /open workflows/i }));
    const drawer = screen.getByRole("dialog", { name: "Workflows" });
    const active = within(drawer)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(active.map((link) => link.getAttribute("href"))).toEqual(["/monitor"]);
  });

  it("covers the full CONCEPT_CYCLE so hotkeys and drawer can never drift", () => {
    render(<ConceptNav compact />);
    fireEvent.click(screen.getByRole("button", { name: /open workflows/i }));
    const drawer = screen.getByRole("dialog", { name: "Workflows" });
    const hrefs = within(drawer)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    for (const href of CONCEPT_CYCLE) expect(hrefs).toContain(href);
  });

  it("labels the tablet current route and does not expose inactive icon-only shortcuts", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    render(<ConceptNav compact />);
    const current = screen.getByRole("navigation", { name: "Current workflow" });
    expect(within(current).getAllByRole("link").map((link) => link.textContent)).toEqual(["Alert Monitor"]);
    const disclosure = screen.getByRole("button", { name: /open workflows/i });
    expect(disclosure.textContent).toContain("Workflows");
    expect(disclosure.id).toBe("workflow-disclosure");
    disclosure.focus();
    expect(document.activeElement).toBe(disclosure);
    expect(screen.getByRole("button", { name: "Ask CAOS" })).toBeTruthy();
  });

  it("preserves reference mode and analysis context without duplicating either", async () => {
    window.history.replaceState({}, "", "/monitor?context=ctx-1&mode=reference");
    render(<ConceptNav compact />);
    fireEvent.click(screen.getByRole("button", { name: /open workflows/i }));
    const drawer = screen.getByRole("dialog", { name: "Workflows" });
    await waitFor(() => {
      expect(within(drawer).getByRole("link", { name: "Deep-Dive" }).getAttribute("href"))
        .toBe("/deepdive?context=ctx-1&mode=reference");
      expect(within(drawer).getByRole("link", { name: "Settings" }).getAttribute("href"))
        .toBe("/settings?context=ctx-1&mode=reference");
    });
  });
});
