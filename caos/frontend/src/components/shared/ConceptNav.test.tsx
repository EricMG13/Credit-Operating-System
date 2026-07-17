// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { ConceptNav } from "./ConceptNav";
import { CONCEPT_CYCLE, NAV_GROUPS } from "@/lib/nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/monitor" }));
vi.mock("./AnalystBadge", () => ({ AnalystBadge: () => null }));
vi.mock("./RoleViewSwitch", () => ({ RoleViewSwitch: () => null }));

afterEach(cleanup);

describe("ConceptNav compact — Concepts drawer (guaranteed nav path)", () => {
  it("pipeline-13 pipeline-35 exposes a Concepts trigger that lists every concept with its full label", () => {
    render(<ConceptNav compact />);
    fireEvent.click(screen.getByRole("button", { name: /open concepts/i }));
    const drawer = screen.getByRole("dialog", { name: "Concepts" });
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
    fireEvent.click(screen.getByRole("button", { name: /open concepts/i }));
    const drawer = screen.getByRole("dialog", { name: "Concepts" });
    const active = within(drawer)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(active.map((link) => link.getAttribute("href"))).toEqual(["/monitor"]);
  });

  it("covers the full CONCEPT_CYCLE so hotkeys and drawer can never drift", () => {
    render(<ConceptNav compact />);
    fireEvent.click(screen.getByRole("button", { name: /open concepts/i }));
    const drawer = screen.getByRole("dialog", { name: "Concepts" });
    const hrefs = within(drawer)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    for (const href of CONCEPT_CYCLE) expect(hrefs).toContain(href);
  });
});
