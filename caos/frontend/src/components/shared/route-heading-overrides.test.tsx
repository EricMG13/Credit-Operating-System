// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>,
  pathname: "/reports" as string | null,
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/components/shared/AuthProvider", () => ({ useAuth: () => state.auth }));

import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import { RequireAuth } from "./RequireAuth";
import RouteErrorBoundary from "./RouteErrorBoundary";
import { RouteHeading, RouteHeadingProvider } from "./RouteHeading";

function renderWithHeading(surface: React.ReactNode) {
  return render(<RouteHeadingProvider><RouteHeading />{surface}</RouteHeadingProvider>);
}

afterEach(() => {
  cleanup();
  state.pathname = "/reports";
  state.auth = {};
  vi.restoreAllMocks();
});

describe("single accurate route heading overrides", () => {
  it.each([
    [{ loading: true }, "Checking analyst access"],
    [{ loading: false, needsLogin: true, refresh: vi.fn() }, "Analyst sign-in"],
    [{ loading: false, needsLogin: false, error: true, user: null, refresh: vi.fn() }, "Analyst access could not be verified"],
  ])("announces the rendered auth surface %#", async (auth, name) => {
    state.auth = auth;
    renderWithHeading(<RequireAuth>workspace</RequireAuth>);
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1));
    expect(screen.getByRole("heading", { level: 1, name })).toBeTruthy();
  });

  it("announces the route error instead of the underlying route", async () => {
    state.auth = { loading: false, user: { id: "analyst" } };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithHeading(<RouteErrorBoundary error={new Error("broken")} reset={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "This view could not load" })).toBeTruthy());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it("announces page-not-found instead of a generic fallback", () => {
    state.auth = { loading: false, user: { id: "analyst" } };
    state.pathname = "/does-not-exist";
    renderWithHeading(<NotFound />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
  });

  it("keeps the standalone global error's sole h1 accurate", () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error("broken")} reset={vi.fn()} />);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("h1")?.textContent).toBe("The workspace failed to load");
  });
});
