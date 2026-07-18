// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { setRoleView, updateAnalystWorkspace } = vi.hoisted(() => ({
  setRoleView: vi.fn(),
  updateAnalystWorkspace: vi.fn(),
}));

vi.mock("@/components/shared/ConceptNav", () => ({
  ConceptNav: () => <span data-testid="concept-nav" />,
}));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: "analyst", setRoleView }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  updateAnalystWorkspace,
}));

import { OutSections } from "@/components/deepdive/OutSections";
import { StandingViewStrip } from "@/components/deepdive/StandingViewStrip";
import { ActionReason } from "@/components/shared/ActionReason";
import { AuthorityBlock } from "@/components/shared/AuthorityBlock";
import { BatchBar } from "@/components/shared/BatchBar";
import { ModelModeToggle } from "@/components/shared/ModelModeToggle";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { RoleViewSwitch } from "@/components/shared/RoleViewSwitch";
import RouteErrorBoundary from "@/components/shared/RouteErrorBoundary";
import { ScopeLabel } from "@/components/shared/ScopeLabel";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SlideOver } from "@/components/shared/SlideOver";
import { StatCard } from "@/components/shared/StatCard";
import { TextInput } from "@/components/shared/TextInput";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import type { OutSection } from "@/lib/deepdive/module-outputs";
import { DEBATE } from "@/lib/reports/deal";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setRoleView.mockReset();
  updateAnalystWorkspace.mockReset();
});

describe("shared component coverage edges", () => {
  it("renders optional primitive branches and non-scalar stat values", () => {
    render(
      <>
        <TextInput aria-label="Plain input" />
        <SectionHeader title="Header" right="As of now" />
        <SectionHeader title="Header without metadata" />
        <ShellIdentity title="Command" />
        <ShellIdentity title="Overlay" showConceptNav={false} />
        <ScopeLabel scope="device" />
        <ScopeLabel scope="workspace" />
        <StatCard value={<strong>42</strong>} label="Metric" />
        <AuthorityBlock prov={null} />
      </>,
    );
    expect(screen.getByLabelText("Plain input").className).not.toContain("undefined");
    expect(screen.getByText("As of now")).toBeTruthy();
    expect(screen.getByTestId("concept-nav")).toBeTruthy();
    expect(screen.getByText("THIS BROWSER")).toBeTruthy();
    expect(screen.getByText("WORKSPACE · READ-ONLY")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("ORIGIN: UNKNOWN");
  });

  it("supports non-string slide-over titles and role/mode button callbacks", () => {
    const close = vi.fn();
    const changeMode = vi.fn();
    render(
      <>
        <SlideOver title={<span>Evidence title</span>} onClose={close}>Body</SlideOver>
        <RoleViewSwitch />
        <ModelModeToggle value="TEST" onChange={changeMode} />
      </>,
    );
    expect(screen.getByRole("dialog").hasAttribute("aria-label")).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "PM" }));
    expect(setRoleView).toHaveBeenCalledWith("pm");
    fireEvent.click(screen.getByRole("button", { name: /Max/i }));
    expect(changeMode).toHaveBeenCalledWith("MAX");
    fireEvent.click(screen.getByTitle("Close (Esc)"));
    expect(close).toHaveBeenCalled();
  });

  it("reports non-Error batch failures per item", async () => {
    render(
      <BatchBar
        selected={["one"]}
        onClear={vi.fn()}
        actions={[{ id: "fail", label: "Fail", run: async () => Promise.reject("nope") }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect((await screen.findByRole("status")).textContent).toContain("0/1 succeeded");
  });

  it("logs route errors and retries through the supplied reset", async () => {
    const error = new Error("broken");
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<RouteErrorBoundary error={error} reset={reset} />);
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(error));
    fireEvent.click(screen.getByRole("button", { name: "Retry view load" }));
    expect(reset).toHaveBeenCalled();
  });

  it("reuses and clears the hidden action-reason timer", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        <ActionReason reason="Needs evidence" reasonDisplay="hidden">Export</ActionReason>,
      );
      const button = screen.getByRole("button", { name: "Export" });
      fireEvent.click(button);
      fireEvent.click(button);
      expect(screen.getByText("Needs evidence").getAttribute("role")).toBe("status");
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders count and secondary action branches in workbench chrome", () => {
    const onClick = vi.fn();
    render(
      <WorkbenchToolbar
        title="Coverage"
        count="2 names"
        actions={[{ id: "refresh", label: "Refresh", onClick }]}
      />,
    );
    expect(screen.getByText("2 names")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders primary workbench actions without an optional count", () => {
    const onClick = vi.fn();
    render(
      <WorkbenchToolbar
        title="Primary coverage"
        actions={[{ id: "run", label: "Run", onClick, primary: true }]}
      />,
    );
    const button = screen.getByRole("button", { name: "Run" });
    expect(button.className).toContain("caos-action-primary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it("keeps a narrow persona drawer open when its dialog body is clicked", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(max-width: 1099px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    render(
      <PersonaWorkbench surface="query" primary={<div>Graph</div>} context={<div>Context body</div>} />,
    );
    const trigger = await screen.findByRole("button", { name: "Open context drawer" });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders a standing view whose bias has no explanatory tail", () => {
    const prior = DEBATE.bias;
    try {
      DEBATE.bias = "POSITIVE";
      render(
        <StandingViewStrip
          isReference
          issuerId="issuer-1"
          runId="run-1"
          onRevise={vi.fn()}
        />,
      );
      expect(screen.getByText("POSITIVE")).toBeTruthy();
      expect(screen.queryByText(/^—/)).toBeNull();
    } finally {
      DEBATE.bias = prior;
    }
  });

  it("handles missing flag evidence and a fresh affirmation list", async () => {
    const sections: OutSection[] = [{
      type: "flags",
      title: "Flags",
      items: [{ sev: "warning", text: "No evidence yet" }],
    }];
    updateAnalystWorkspace.mockImplementation(async (update: (workspace: Record<string, unknown>) => unknown) => {
      update({ affirmations: null });
      return {};
    });
    render(
      <>
        <OutSections sections={sections} onOpenEvidence={vi.fn()} />
        <StandingViewStrip
          isReference
          issuerId="issuer-1"
          runId={null}
          onRevise={vi.fn()}
        />
      </>,
    );
    expect(screen.getByText("No evidence yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Note agreement" }));
    expect(await screen.findByRole("button", { name: "Noted" })).toBeTruthy();
  });
});
