// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const controls = vi.hoisted(() => ({
  replace: vi.fn(),
  roleView: "analyst" as "analyst" | "pm" | "qa",
  ready: true,
  query: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: controls.replace }),
  useSearchParams: () => new URLSearchParams(controls.query),
}));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: controls.roleView, ready: controls.ready }),
}));
vi.mock("@/components/shared/SurfaceState", () => ({
  SurfaceState: ({ title }: { title: string }) => <span>{title}</span>,
}));

import Home from "./page";

afterEach(() => {
  cleanup();
  controls.replace.mockReset();
  controls.roleView = "analyst";
  controls.ready = true;
  controls.query = "";
});

describe("Home", () => {
  it.each([
    ["analyst", "/issuers"],
    ["pm", "/command"],
    ["qa", "/monitor"],
  ] as const)("routes an unaffiliated root visit for %s", async (roleView, destination) => {
    controls.roleView = roleView;
    render(<Home />);
    await waitFor(() => expect(controls.replace).toHaveBeenCalledWith(destination));
  });

  it("waits for the existing role preference to resolve", () => {
    controls.ready = false;
    render(<Home />);
    expect(controls.replace).not.toHaveBeenCalled();
  });

  it("preserves an explicit root query instead of applying a role default", async () => {
    controls.roleView = "pm";
    controls.query = "issuer=issuer-1&context=context-1";
    render(<Home />);
    await waitFor(() => expect(controls.replace).toHaveBeenCalledWith("/issuers?issuer=issuer-1&context=context-1"));
  });
});
