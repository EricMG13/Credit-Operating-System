// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/AuthProvider", () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/RoleViewProvider", () => ({ RoleViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/Ask", () => ({ AskProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, AskLauncher: () => <span>ask launcher</span> }));
vi.mock("@/components/shared/Notifications", () => ({ NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/IssuerProfileOverlay", () => ({ IssuerProfileOverlayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, IssuerProfileOverlay: () => <span>profile overlay</span> }));
vi.mock("@/components/shared/NavigationGuardProvider", () => ({ NavigationGuardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/ConceptHotkeys", () => ({ ConceptHotkeys: () => <span>hotkeys</span> }));
vi.mock("@/components/shared/ShortcutHelp", () => ({ ShortcutHelp: () => <span>shortcut help</span> }));
vi.mock("@/components/shared/CommandPalette", () => ({ CommandPalette: () => <span>command palette</span> }));
vi.mock("@/components/shared/RouteHeading", () => ({ RouteHeading: () => <h1>route heading</h1> }));
vi.mock("@/components/shared/WorkflowRail", () => ({ WorkflowRail: () => <nav>workflow rail</nav> }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/EnterprisePage", () => ({ EnterprisePage: ({ identity, primaryAction, contextualControls, children }: { identity?: React.ReactNode; primaryAction?: React.ReactNode; contextualControls?: React.ReactNode; children: React.ReactNode }) => <main>{identity}{primaryAction}{contextualControls}{children}</main> }));
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
    render(<RootLayout><div>route body</div></RootLayout>);
    expect(screen.getByText("route body")).toBeTruthy();
    expect(screen.getByText("workflow rail")).toBeTruthy();
    expect(screen.getByText("command palette")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
    expect(screen.getByRole("link", { name: "Skip to navigation" }).getAttribute("href")).toBe("#concept-nav");
    error.mockRestore();
  });

  it("renders the authenticated intake workspace and persistent MNPI marker", () => {
    render(<UploadPage />);
    expect(screen.getByText("upload wizard")).toBeTruthy();
    expect(screen.getAllByText("MNPI · restricted handling enforced")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Jump to intake form" }).getAttribute("href")).toBe("#intake-workspace");
    expect(screen.getByText(/PDF \/ XLSX/)).toBeTruthy();
  });
});
