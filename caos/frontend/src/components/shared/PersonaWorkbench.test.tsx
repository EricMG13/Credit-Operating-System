// @vitest-environment jsdom
import React, { Component, useEffect, useState, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { createPortal } from "react-dom";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DominantTableRegion } from "./DominantTableRegion";
import { PersonaWorkbench } from "./PersonaWorkbench";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      const element = this as HTMLElement;
      if (
        element.hidden
        || element.getAttribute("aria-hidden") === "true"
        || element.style.display === "none"
        || element.style.visibility === "hidden"
      ) return null;
      return document.body;
    },
  });
});

function setNarrow(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width") ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("PersonaWorkbench", () => {
  it("hydrates narrow layouts from the same desktop snapshot and preserves the primary node", async () => {
    setNarrow(true);
    let primaryMounts = 0;
    function Primary() {
      useEffect(() => {
        primaryMounts += 1;
      }, []);
      return <div data-testid="hydrated-primary">Primary dossier</div>;
    }
    const workbench = (
      <PersonaWorkbench
        surface="deep-dive"
        persona="analyst"
        primary={<Primary />}
        context={<div>Hydrated context</div>}
        inspector={<div>Hydrated inspector</div>}
      />
    );
    const container = document.createElement("div");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    container.innerHTML = renderToString(workbench);
    document.body.appendChild(container);
    const serverPrimary = container.querySelector("[data-testid='hydrated-primary']");
    let root: Root | undefined;

    await act(async () => {
      root = hydrateRoot(container, workbench);
    });
    await waitFor(() => expect(container.querySelector(
      "[aria-label='Workbench supporting panels']",
    )).toBeTruthy());

    expect(container.querySelector("[data-testid='hydrated-primary']")).toBe(serverPrimary);
    expect(primaryMounts).toBe(1);
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match/i);

    await act(async () => root?.unmount());
    container.remove();
  });

  it("reorders presentation without mutating supplied data or remounting primary", () => {
    setNarrow(false);
    const records = Object.freeze([{ id: "issuer-1", leverage: 4.2 }]);
    const context = Object.freeze({ id: "context-1", asOf: "2026-07-13" });
    const primary = (
      <div data-testid="primary">
        {records[0].id} · {context.id}
      </div>
    );
    const before = JSON.stringify({ records, context });
    const { rerender } = render(
      <PersonaWorkbench surface="issuers" persona="analyst" primary={primary} />,
    );
    const primaryNode = screen.getByTestId("primary");

    rerender(<PersonaWorkbench surface="issuers" persona="pm" primary={primary} />);

    expect(screen.getByTestId("primary")).toBe(primaryNode);
    expect(JSON.stringify({ records, context })).toBe(before);
    expect(screen.getByTestId("persona-workbench").getAttribute("data-persona")).toBe("pm");
  });

  it("maps persona support order to the actual grid while keeping primary first", async () => {
    setNarrow(false);
    const { rerender } = render(
      <PersonaWorkbench
        surface="issuers"
        persona="analyst"
        decision={<button type="button">Decision header action</button>}
        primary={<button type="button">Primary action</button>}
        context={<button type="button">Context action</button>}
        inspector={<button type="button">Inspector action</button>}
      />,
    );
    let slots = Array.from(screen.getByTestId("persona-workbench").querySelectorAll<HTMLElement>("[data-slot]"));
    expect(slots.map((slot) => slot.dataset.slot)).toEqual(["decision", "primary", "context", "inspector"]);
    expect(slots[0].style.gridArea).toBe("decision");
    expect(slots[1].style.gridArea).toBe("primary");
    expect(slots[2].style.gridArea).toBe("support-a");
    expect(slots[3].style.gridArea).toBe("support-b");

    rerender(
      <PersonaWorkbench
        surface="issuers"
        persona="pm"
        decision={<button type="button">Decision header action</button>}
        primary={<button type="button">Primary action</button>}
        context={<button type="button">Context action</button>}
        inspector={<button type="button">Inspector action</button>}
      />,
    );
    await waitFor(() => expect(screen.getByRole(
      "button",
      { name: "Open evidence inspector panel" },
    )).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Open evidence inspector panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Open context panel" }));
    slots = Array.from(screen.getByTestId("persona-workbench").querySelectorAll<HTMLElement>("[data-slot]"));
    expect(slots.map((slot) => slot.dataset.slot)).toEqual(["decision", "primary", "inspector", "context"]);
    expect(slots[0].style.gridArea).toBe("decision");
    expect(slots[1].style.gridArea).toBe("primary");
    expect(slots[2].style.gridArea).toBe("support-a");
    expect(slots[3].style.gridArea).toBe("support-b");
  });

  it("applies persona panel defaults while preserving toggles, evidence access, and primary identity", async () => {
    setNarrow(false);
    const primary = <div data-testid="default-primary">Primary dossier</div>;
    const props = {
      surface: "deep-dive" as const,
      primary,
      context: <div data-testid="default-context">Context rail</div>,
      inspector: <div data-testid="default-inspector">Evidence inspector</div>,
    };
    const { rerender } = render(<PersonaWorkbench {...props} persona="analyst" />);
    const primaryNode = screen.getByTestId("default-primary");

    expect(screen.getByTestId("default-context")).toBeTruthy();
    expect(screen.getByTestId("default-inspector")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse context panel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse evidence inspector panel" })).toBeTruthy();

    rerender(<PersonaWorkbench {...props} persona="pm" />);
    await waitFor(() => expect(screen.queryByTestId("default-context")).toBeNull());
    expect(screen.queryByTestId("default-inspector")).toBeNull();
    expect(screen.getByTestId("default-primary")).toBe(primaryNode);
    fireEvent.click(screen.getByRole("button", { name: "Open evidence inspector panel" }));
    expect(screen.getByTestId("default-inspector")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open context panel" }));
    expect(screen.getByTestId("default-context")).toBeTruthy();
  });

  it("reclaims support columns for zero, one, and two visible desktop panels", () => {
    setNarrow(false);
    render(
      <PersonaWorkbench
        surface="deep-dive"
        persona="pm"
        decision={<div>Decision header</div>}
        primary={<div data-testid="support-primary">Primary dossier</div>}
        context={<div data-testid="support-context">Context rail</div>}
        inspector={<div data-testid="support-inspector">Evidence inspector</div>}
      />,
    );
    const composition = screen.getByTestId("persona-workbench").querySelector<HTMLElement>(
      ".persona-workbench__composition",
    )!;

    expect(composition.dataset.visibleSupportCount).toBe("0");
    expect(composition.classList.contains("persona-workbench__composition--supports-0")).toBe(true);
    expect(screen.getByTestId("support-primary").parentElement?.style.gridArea).toBe("primary");
    expect(screen.queryByTestId("support-context")).toBeNull();
    expect(screen.queryByTestId("support-inspector")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open context panel" }));
    expect(composition.dataset.visibleSupportCount).toBe("1");
    expect(composition.classList.contains("persona-workbench__composition--supports-1")).toBe(true);
    expect(screen.getByTestId("support-context").parentElement?.style.gridArea).toBe("support-a");

    fireEvent.click(screen.getByRole("button", { name: "Open evidence inspector panel" }));
    expect(composition.dataset.visibleSupportCount).toBe("2");
    expect(composition.classList.contains("persona-workbench__composition--supports-2")).toBe(true);
    expect(screen.getByTestId("support-inspector").parentElement?.style.gridArea).toBe("support-a");
    expect(screen.getByTestId("support-context").parentElement?.style.gridArea).toBe("support-b");

    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/composition--supports-0\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/composition--supports-1\s*\{[^}]*grid-template-columns:[^;}]*minmax\(220px,\s*0\.34fr\)/);
    expect(css).toMatch(/composition--supports-2\s*\{[^}]*grid-template-columns:[^;}]*minmax\(240px,\s*0\.38fr\)/);
  });

  it("uses the canonical modal behavior for narrow drawers", async () => {
    setNarrow(true);
    render(
      <PersonaWorkbench
        surface="deep-dive"
        persona="analyst"
        primary={<div>Primary dossier</div>}
        context={(
          <div>
            <input aria-label="Hidden context control" style={{ display: "none" }} />
            <input aria-label="Visible context control" />
          </div>
        )}
        inspector={<div data-testid="evidence-inspector">Evidence inspector</div>}
      />,
    );

    const contextTrigger = screen.getByRole("button", { name: "Open context drawer" });
    contextTrigger.focus();
    fireEvent.click(contextTrigger);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Context" })).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Visible context control" }),
    ));
    expect(document.activeElement).not.toBe(screen.getByLabelText("Hidden context control"));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Context" })).toBeNull());
    expect(document.activeElement).toBe(contextTrigger);
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Open evidence inspector drawer" }));
    expect(await screen.findByRole("dialog", { name: "Evidence inspector" })).toBeTruthy();
    expect(screen.getAllByTestId("evidence-inspector")).toHaveLength(1);
  });

  class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    render() {
      return this.state.error
        ? <div role="alert">{this.state.error.message}</div>
        : this.props.children;
    }
  }

  it("rejects a second dominant owner mounted asynchronously", async () => {
    setNarrow(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    function AsyncOwner() {
      const [mounted, setMounted] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setMounted(true)}>Mount second owner</button>
          {mounted ? <DominantTableRegion ownerId="async-grid" label="Async grid" /> : null}
        </div>
      );
    }
    render(
      <Boundary>
        <PersonaWorkbench
          surface="issuers"
          persona="analyst"
          primary={<DominantTableRegion ownerId="issuer-grid" label="Issuer grid" />}
          utility={<AsyncOwner />}
        />
      </Boundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mount second owner" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/one visible dominant table owner/i);
  });

  it("rechecks an initially hidden dominant owner when it becomes visible", async () => {
    setNarrow(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    function VisibilityOwner() {
      const [hidden, setHidden] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setHidden(false)}>Show second owner</button>
          <DominantTableRegion hidden={hidden} ownerId="visibility-grid" label="Visibility grid" />
        </div>
      );
    }
    render(
      <Boundary>
        <PersonaWorkbench
          surface="issuers"
          persona="analyst"
          primary={<DominantTableRegion ownerId="issuer-grid" label="Issuer grid" />}
          utility={<VisibilityOwner />}
        />
      </Boundary>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show second owner" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/visibility-grid/i);
  });

  it("rejects a portal-mounted second dominant owner", async () => {
    setNarrow(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const portalHost = document.createElement("div");
    document.body.appendChild(portalHost);
    render(
      <Boundary>
        <PersonaWorkbench
          surface="issuers"
          persona="analyst"
          primary={<DominantTableRegion ownerId="issuer-grid" label="Issuer grid" />}
          utility={createPortal(
            <DominantTableRegion ownerId="portal-grid" label="Portal grid" />,
            portalHost,
          )}
        />
      </Boundary>,
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/issuer-grid, portal-grid|portal-grid, issuer-grid/i);
    portalHost.remove();
  });

  it("rejects two initially visible worklist table owners", async () => {
    setNarrow(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Boundary>
        <PersonaWorkbench
          surface="issuers"
          persona="analyst"
          primary={<DominantTableRegion ownerId="issuer-grid" label="Issuer grid" />}
          context={<DominantTableRegion ownerId="second-grid" label="Second grid" />}
        />
      </Boundary>,
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/one visible dominant table owner/i);
  });

  it("allows document, model, report, and accessible-fallback exemptions", () => {
    setNarrow(false);
    render(
      <PersonaWorkbench
        surface="issuers"
        persona="analyst"
        primary={<DominantTableRegion ownerId="issuer-grid" label="Issuer grid" />}
        context={(
          <div>
            <DominantTableRegion ownerId="document-table" label="Document table" exemption="document" />
            <DominantTableRegion ownerId="model-table" label="Model table" exemption="model" />
            <DominantTableRegion ownerId="report-table" label="Report table" exemption="report-studio" />
            <DominantTableRegion ownerId="fallback-table" label="Chart data" exemption="accessible-fallback" />
          </div>
        )}
      />,
    );
    const workbench = screen.getByTestId("persona-workbench");
    expect(workbench.querySelectorAll("[data-caos-dominant-table-owner]")).toHaveLength(1);
    expect(workbench.querySelectorAll("[data-caos-table-exemption]")).toHaveLength(4);
  });
});
