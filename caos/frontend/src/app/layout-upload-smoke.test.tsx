// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type TestPageAction = { label: string; href?: string; onAction?: () => void; unavailableReason?: string | null };

function renderPageAction(action?: TestPageAction) {
  if (!action) return null;
  if (action.href && !action.unavailableReason) return <a href={action.href}>{action.label}</a>;
  return <button type="button" aria-disabled={action.unavailableReason ? "true" : undefined} onClick={action.unavailableReason ? undefined : action.onAction}>{action.label}</button>;
}

vi.mock("@/components/shared/AuthProvider", () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/RoleViewProvider", () => ({ RoleViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AskContext", () => ({ AskProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AskShell", () => ({ AskLauncher: () => <span>ask launcher</span> }));
vi.mock("@/components/shared/Notifications", () => ({ NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/IssuerProfileOverlay", () => ({ IssuerProfileOverlayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, IssuerProfileOverlay: () => <span>profile overlay</span> }));
vi.mock("@/components/shared/NavigationGuardProvider", () => ({ NavigationGuardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/ConceptHotkeys", () => ({ ConceptHotkeys: () => <span>hotkeys</span> }));
vi.mock("@/components/shared/ShortcutHelp", () => ({ ShortcutHelp: () => <span>shortcut help</span> }));
vi.mock("@/components/shared/CommandPalette", () => ({ CommandPalette: () => <span>command palette</span> }));
vi.mock("@/components/shared/RouteHeading", () => ({
  RouteHeading: () => <h1>route heading</h1>,
  RouteHeadingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/WorkflowRail", () => ({ WorkflowRail: () => <nav id="workflow-priority-nav" tabIndex={-1}>workflow rail</nav> }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/EnterprisePage", () => ({ EnterprisePage: ({ identity, primaryAction, contextualControls, children }: { identity?: React.ReactNode; primaryAction?: TestPageAction; contextualControls?: React.ReactNode; children: React.ReactNode }) => <main>{identity}{renderPageAction(primaryAction)}{contextualControls}{children}</main> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ primary }: { primary: React.ReactNode }) => <>{primary}</> }));
vi.mock("@/components/shared/ShellIdentity", () => ({ ShellIdentity: ({ title, children }: { title: string; children?: React.ReactNode }) => <header>{title}{children}</header> }));
vi.mock("@/components/upload/UploadWizard", () => ({ UploadWizard: () => <div>upload wizard</div> }));

import RootLayout, { metadata, viewport } from "./layout";
import UploadPage from "./upload/page";

afterEach(cleanup);

describe("root and upload routes", () => {
  it("declares the application metadata and composes every root provider", () => {
    expect(metadata.title).toBe("Credit Agent OS (CAOS)");
    expect(viewport.themeColor).toBe("#0a0a0f");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<RootLayout><div>route body</div><button id="workflow-disclosure">Workflows</button><nav id="concept-nav" tabIndex={-1} aria-label="Current workflow">Current workflow</nav><div id="page-actions" tabIndex={-1}>Page actions</div></RootLayout>);
    expect(screen.getByText("route body")).toBeTruthy();
    expect(screen.getByText("workflow rail")).toBeTruthy();
    expect(screen.getByText("command palette")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
    const navigationLinks = screen.getAllByRole("link", { name: "Skip to navigation" });
    expect(navigationLinks.map((link) => link.getAttribute("href"))).toEqual([
      "#workflow-priority-nav",
      "#workflow-disclosure",
    ]);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    fireEvent.click(navigationLinks[0]);
    expect(document.activeElement).toBe(document.getElementById("workflow-priority-nav"));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    fireEvent.click(navigationLinks[1]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Workflows" }));
    const actionsLink = screen.getByRole("link", { name: "Skip to page actions" });
    expect(actionsLink.getAttribute("href")).toBe("#page-actions");
    fireEvent.click(actionsLink);
    expect(document.activeElement).toBe(document.getElementById("page-actions"));
    error.mockRestore();
  });

  it("does not expose the global page-actions skip link when a route has no action region", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<RootLayout><div>standalone route</div></RootLayout>);
    expect(screen.queryByRole("link", { name: "Skip to page actions" })).toBeNull();
    error.mockRestore();
  });

  it("renders the authenticated intake workspace and persistent MNPI marker", () => {
    render(<UploadPage />);
    expect(screen.getByText("upload wizard")).toBeTruthy();
    const disclosure = screen.getByText("MNPI handling policy applies · analyst-declared classification").closest("summary") as HTMLElement;
    expect(disclosure).toBeTruthy();
    expect(disclosure.tabIndex).toBe(0);
    fireEvent.click(disclosure);
    expect(screen.getByText(/Classification is declared by the analyst; CAOS does not detect MNPI/)).toBeTruthy();
    expect(screen.getByText(/does not itself enforce need-to-know entitlements/)).toBeTruthy();
    expect(screen.getByText(/subject to workspace access and governance/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Jump to intake form" })).toBeNull();
    expect(screen.getByText(/PDF \/ XLSX/)).toBeTruthy();
  });
});
