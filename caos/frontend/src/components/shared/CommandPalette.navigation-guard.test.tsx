// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import {
  NavigationGuardProvider,
  useNavigationGuard,
} from "./NavigationGuardProvider";

const push = vi.fn();
const discard = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("./IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => ({ openProfile: vi.fn() }),
}));
vi.mock("./Ask", () => ({
  useAsk: () => ({ openWith: vi.fn() }),
}));
vi.mock("./RoleViewProvider", () => ({
  useRoleView: () => ({ setRoleView: vi.fn() }),
}));

function DirtyModelGuard() {
  useNavigationGuard({ dirty: true, enabled: true, onDiscard: discard });
  return null;
}

afterEach(() => {
  cleanup();
  push.mockClear();
  discard.mockClear();
});

describe("CommandPalette navigation guard", () => {
  it("does not bypass a dirty Model Builder when executing a page command", async () => {
    render(
      <NavigationGuardProvider>
        <DirtyModelGuard />
        <CommandPalette />
      </NavigationGuardProvider>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.mouseDown(await screen.findByText("Model Builder"));

    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", {
      name: "Leave with unsaved changes?",
    })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard & leave" }));
    expect(discard).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/model");
  });
});
