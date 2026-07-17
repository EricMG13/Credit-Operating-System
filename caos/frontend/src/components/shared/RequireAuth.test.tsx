// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>,
}));

vi.mock("@/components/shared/AuthProvider", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/shared/LoginLanding", () => ({
  LoginLanding: ({ onSuccess }: { onSuccess: () => void }) => <button onClick={onSuccess}>finish login</button>,
}));

import { RequireAuth } from "./RequireAuth";

afterEach(() => {
  cleanup();
  state.auth = {};
});

describe("RequireAuth", () => {
  it("shows the loading gate", () => {
    state.auth = { loading: true };
    render(<RequireAuth>workspace</RequireAuth>);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("shows login and forwards successful authentication to refresh", () => {
    const refresh = vi.fn();
    state.auth = { loading: false, needsLogin: true, refresh };
    render(<RequireAuth>workspace</RequireAuth>);
    fireEvent.click(screen.getByRole("button", { name: "finish login" }));
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    [new Error("offline"), { id: "analyst" }],
    [null, null],
  ])("shows the recovery gate for unresolved identity %#", (error, user) => {
    const refresh = vi.fn();
    state.auth = { loading: false, needsLogin: false, error, user, refresh };
    render(<RequireAuth>workspace</RequireAuth>);
    expect(screen.getByText("Can't reach the CAOS API")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RETRY" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("renders the authenticated workspace", () => {
    state.auth = { loading: false, needsLogin: false, error: null, user: { id: "analyst" }, refresh: vi.fn() };
    render(<RequireAuth><span>workspace</span></RequireAuth>);
    expect(screen.getByText("workspace")).toBeTruthy();
  });
});
