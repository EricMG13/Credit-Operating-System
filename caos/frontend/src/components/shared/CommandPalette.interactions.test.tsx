// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationGuardProvider } from "./NavigationGuardProvider";
import { CommandPalette } from "./CommandPalette";
import { getIssuers } from "@/lib/api";

const controls = vi.hoisted(() => ({
  push: vi.fn(),
  openProfile: vi.fn(),
  openWith: vi.fn(),
  setRoleView: vi.fn(),
  paletteMode: "real" as "real" | "empty" | "empty-ask" | "page-only",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: controls.push }),
}));
vi.mock("./IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => ({ openProfile: controls.openProfile }),
}));
vi.mock("./AskContext", () => ({
  useAsk: () => ({ openWith: controls.openWith }),
}));
vi.mock("./RoleViewProvider", () => ({
  useRoleView: () => ({ setRoleView: controls.setRoleView }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIssuers: vi.fn(),
}));
vi.mock("@/lib/palette", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/palette")>();
  return {
    ...actual,
    staticRows: (query: string) => {
      if (controls.paletteMode === "empty") return [];
      if (controls.paletteMode === "empty-ask") return [{ kind: "ask" as const, text: "" }];
      if (controls.paletteMode === "page-only") return [{ kind: "page" as const, href: "/model", label: "Model", group: "Test" }];
      return actual.staticRows(query);
    },
  };
});

function renderPalette() {
  return render(
    <NavigationGuardProvider>
      <CommandPalette />
    </NavigationGuardProvider>,
  );
}

function openPalette(modifier: "metaKey" | "ctrlKey" = "metaKey") {
  fireEvent.keyDown(window, { key: "k", [modifier]: true });
  return screen.getByRole("combobox");
}

beforeEach(() => {
  controls.paletteMode = "real";
  vi.mocked(getIssuers).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("CommandPalette interactions", () => {
  it("toggles from both keyboard modifiers and coordinates explicit and competing modal events", () => {
    const modalEvents = vi.fn();
    window.addEventListener("caos:modal-open", modalEvents);
    const view = renderPalette();

    const meta = openPalette("metaKey");
    expect(document.activeElement).toBe(meta);
    expect(modalEvents).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "K", metaKey: true });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();

    const ctrl = openPalette("ctrlKey");
    expect(ctrl).toBeTruthy();
    fireEvent.click(screen.getByRole("dialog", { name: "Command palette" }));
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "palette" } })));
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "shortcut-help" } })));
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();

    act(() => window.dispatchEvent(new Event("caos:command-palette-open")));
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();
    view.unmount();
    act(() => window.dispatchEvent(new Event("caos:command-palette-open")));
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    window.removeEventListener("caos:modal-open", modalEvents);
  });

  it("debounces issuer lookup, caps results, renders metadata, and opens the selected profile", async () => {
    vi.useFakeTimers();
    vi.mocked(getIssuers).mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      id: `issuer-${index}`,
      name: `Acme ${index}`,
      ticker: index === 0 ? "ACM" : null,
      sector: index === 0 ? "Industrials" : null,
    })) as never);
    renderPalette();
    const input = openPalette();

    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(getIssuers).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "ac" } });
    await act(async () => vi.advanceTimersByTimeAsync(150));
    expect(getIssuers).toHaveBeenCalledWith("ac");
    expect(screen.getAllByText(/^Acme \d$/)).toHaveLength(6);
    expect(screen.queryByText("Acme 6")).toBeNull();
    expect(screen.getByText("ACM · Industrials")).toBeTruthy();

    fireEvent.mouseEnter(screen.getByText("Acme 3").closest('[role="option"]')!);
    fireEvent.mouseDown(screen.getByText("Acme 3"));
    expect(controls.openProfile).toHaveBeenCalledWith("issuer-3");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
  });

  it("drops stale issuer responses and exposes lookup failure without losing static commands", async () => {
    vi.useFakeTimers();
    let resolveOld!: (value: Awaited<ReturnType<typeof getIssuers>>) => void;
    vi.mocked(getIssuers)
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }) as never)
      .mockRejectedValueOnce(new Error("offline"));
    renderPalette();
    const input = openPalette();

    fireEvent.change(input, { target: { value: "old" } });
    await act(async () => vi.advanceTimersByTimeAsync(150));
    fireEvent.change(input, { target: { value: "new" } });
    await act(async () => resolveOld([{ id: "stale", name: "Stale Issuer" }]));
    expect(screen.queryByText("Stale Issuer")).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(150));
    expect(screen.getByText("Issuer lookup unavailable")).toBeTruthy();
    expect(screen.getByText(/Ask CAOS: “new”/)).toBeTruthy();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText("Issuer lookup unavailable")).toBeNull();
    expect(screen.getByText("Command Center")).toBeTruthy();
  });

  it("executes page, Ask, collapse, and role commands through keyboard and pointer paths", () => {
    const collapse = vi.fn();
    window.addEventListener("caos:collapse-toggle", collapse);
    renderPalette();

    let input = openPalette();
    fireEvent.change(input, { target: { value: "Model Builder" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("palette-row-1");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe("palette-row-0");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(controls.push).toHaveBeenCalledWith("/model");

    input = openPalette();
    fireEvent.change(input, { target: { value: "why did leverage move" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(controls.openWith).toHaveBeenCalledWith("why did leverage move");

    input = openPalette();
    fireEvent.change(input, { target: { value: "collapse" } });
    fireEvent.mouseDown(screen.getByText("Collapse / expand panes"));
    expect(collapse).toHaveBeenCalledTimes(1);

    input = openPalette();
    fireEvent.change(input, { target: { value: "role view" } });
    fireEvent.mouseDown(screen.getByText("Role view: QA"));
    expect(controls.setRoleView).toHaveBeenCalledWith("qa");
    window.removeEventListener("caos:collapse-toggle", collapse);
  });

  it("degrades safely when a row provider returns no rows or an empty Ask payload", () => {
    controls.paletteMode = "empty";
    renderPalette();
    let input = openPalette();
    expect(screen.getByText("no matches")).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(controls.openWith).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    controls.paletteMode = "empty-ask";
    input = openPalette();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(controls.openWith).toHaveBeenCalledWith(undefined);
  });

  it("appends issuer hits when a custom static provider has no insertion row", async () => {
    vi.useFakeTimers();
    controls.paletteMode = "page-only";
    vi.mocked(getIssuers).mockResolvedValue([{ id: "issuer-model", name: "Model Holdings" }] as never);
    renderPalette();
    const input = openPalette();
    fireEvent.change(input, { target: { value: "model" } });
    await act(async () => vi.advanceTimersByTimeAsync(150));
    expect(screen.getByText("Model")).toBeTruthy();
    expect(screen.getByText("Model Holdings")).toBeTruthy();
  });
});
