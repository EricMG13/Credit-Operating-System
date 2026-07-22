// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathname, role } = vi.hoisted(() => ({ pathname: { value: "/deepdive/name" }, role: { value: "analyst" as "analyst" | "pm" | "qa" } }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next/link", () => ({
  default: ({ children, href, prefetch: _prefetch, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode; href: string; prefetch?: boolean }) => <a href={href} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) { event.preventDefault(); window.history.pushState({}, "", href); } }} {...props}>{children}</a>,
}));
vi.mock("./RoleViewSwitch", () => ({ RoleViewSwitch: () => <span>role switch</span> }));
vi.mock("./AnalystBadge", () => ({ AnalystBadge: () => <span>analyst badge</span> }));
vi.mock("./AskShell", () => ({ AskUtility: () => <button type="button" aria-label="Ask CAOS">Ask</button> }));
vi.mock("./RoleViewProvider", () => ({ useRoleView: () => ({ roleView: role.value, setRoleView: vi.fn(), ready: true }) }));

import { WorkflowRail } from "./WorkflowRail";
import { DataModeMarker, OpenReferenceExample } from "./DataMode";
import { NAV_GROUPS } from "@/lib/nav";
import Link from "next/link";

afterEach(() => { cleanup(); pathname.value = "/deepdive/name"; role.value = "analyst"; });

describe("shared workspace shell", () => {
  it("renders the workflow registry and marks nested and settings routes active", () => {
    const { rerender } = render(<WorkflowRail />);
    const rail = screen.getByRole("complementary", { name: "Workspace navigation" });
    expect(within(rail).getByRole("link", { name: "Deep-Dive" }).getAttribute("aria-current")).toBe("page");
    expect(within(rail).getByText("role switch")).toBeTruthy();
    expect(within(rail).getByRole("button", { name: "Ask CAOS" })).toBeTruthy();
    pathname.value = "/settings/access";
    rerender(<WorkflowRail />);
    expect(within(rail).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
  });

  it("shows role priorities, retains an off-list active route, and discloses every workflow", async () => {
    role.value = "pm";
    pathname.value = "/deepdive/name";
    render(<WorkflowRail />);
    const priority = screen.getByRole("navigation", { name: "PM priority workflows" });
    expect(within(priority).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/command", "/portfolios", "/decisions", "/reports", "/monitor", "/deepdive",
    ]);
    expect(within(priority).getByRole("link", { name: "Deep-Dive" }).getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByText("All Workflows"));
    const all = await screen.findByRole("navigation", { name: "All Workflows" });
    const canonical = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(within(all).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(canonical);
  });

  it("makes the wide navigation landmark an actionable skip-focus destination", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    render(<WorkflowRail />);
    const priority = screen.getByRole("navigation", { name: "Analyst priority workflows" });
    expect(priority.getAttribute("tabindex")).toBe("-1");
    priority.focus();
    expect(document.activeElement).toBe(priority);
  });

  it("preserves explicit reference mode across wide workflow and utility links", async () => {
    window.history.replaceState({}, "", "/deepdive?mode=reference&issuer=iss-1");
    render(<WorkflowRail />);
    const priority = screen.getByRole("navigation", { name: "Analyst priority workflows" });
    expect(within(priority).getByRole("link", { name: "Model Builder" }).getAttribute("href"))
      .toBe("/model?mode=reference");
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href"))
      .toBe("/settings?mode=reference");
    window.history.replaceState({}, "", "/deepdive/name");
  });

  it("updates the persistent marker and rail across Link and typed-history mode round trips", async () => {
    window.history.replaceState({}, "", "/deepdive?context=ctx-1");
    render(<><WorkflowRail /><DataModeMarker /><OpenReferenceExample href="/deepdive?context=ctx-1" /><Link href="/deepdive?context=ctx-1">Return to live</Link></>);
    const model = () => within(screen.getByRole("navigation", { name: "Analyst priority workflows" })).getByRole("link", { name: "Model Builder" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(model().getAttribute("href")).toBe("/model");

    fireEvent.click(screen.getByRole("link", { name: "Open reference example" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("REFERENCE · seeded, not issuer data"));
    expect(model().getAttribute("href")).toBe("/model?mode=reference");

    fireEvent.click(screen.getByRole("link", { name: "Return to live" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(model().getAttribute("href")).toBe("/model");

    act(() => window.history.replaceState({}, "", "/deepdive?context=ctx-1&mode=reference"));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    act(() => window.history.replaceState({}, "", "/deepdive?context=ctx-1"));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

});
