// @vitest-environment jsdom
// Locks the help-overlay contract: "?" opens a dialog listing ONLY registered
// bindings (global + route-scoped), Escape closes it, and typing "?" inside an
// input never hijacks the keystroke.
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShortcutHelp } from "./ShortcutHelp";
import { ConceptHotkeys } from "./ConceptHotkeys";
import { SHORTCUTS } from "@/lib/shortcuts";

let pathname: string | null = "/command";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/shared/NavigationGuardProvider", () => ({
  useNavigationAttempt: () => (run: () => void) => run(),
}));

afterEach(() => { cleanup(); pathname = "/command"; });

describe("ShortcutHelp", () => {
  it("opens on ? with the global bindings and closes on Escape", () => {
    render(<><ConceptHotkeys /><ShortcutHelp /></>);
    fireEvent.keyDown(window, { key: "?" });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog.textContent).toContain("Open the command palette");
    expect(dialog.textContent).toContain("Cycle between concepts");
    // /command has no route-scoped bindings — nothing route-labeled renders.
    expect(screen.queryByText("Report Studio")).toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists the route-scoped bindings on their surface", () => {
    pathname = "/reports";
    render(<><ConceptHotkeys /><ShortcutHelp /></>);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByText("Report Studio")).toBeTruthy();
    expect(screen.getByText("Fit the sheet to the preview width")).toBeTruthy();
  });

  it("stops panel clicks, closes from the backdrop and close button, and tolerates a null pathname", () => {
    pathname = null;
    render(<ShortcutHelp />);
    fireEvent(window, new CustomEvent("caos:help-open"));
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close shortcut reference" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent(window, new CustomEvent("caos:help-open"));
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("relinquishes ownership when a bare modal-open event is dispatched", () => {
    render(<ShortcutHelp />);
    fireEvent(window, new CustomEvent("caos:help-open"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent(window, new Event("caos:modal-open"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses the generic page label when the active route mixes shortcut scopes", () => {
    pathname = "/deepdive";
    render(<ShortcutHelp />);
    fireEvent(window, new CustomEvent("caos:help-open"));
    expect(screen.getByText("This page")).toBeTruthy();
    expect(screen.getByText("Find a module by code or name")).toBeTruthy();
    expect(screen.getByText("Cycle sub-views within the surface")).toBeTruthy();
  });

  it("never hijacks ? typed into an editable field", () => {
    render(<><input aria-label="probe" /><ConceptHotkeys /><ShortcutHelp /></>);
    const input = screen.getByLabelText("probe");
    input.focus();
    fireEvent.keyDown(input, { key: "?" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("registry entries carry display keys and labels (nothing empty ships)", () => {
    for (const entry of SHORTCUTS) {
      expect(entry.keys.trim().length).toBeGreaterThan(0);
      expect(entry.label.trim().length).toBeGreaterThan(0);
    }
  });
});
