// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelAuthorityRoute } from "./ModelAuthorityRoute";

const state = vi.hoisted(() => ({
  authority: { mode: "v2-confirmed", response: { detail: "ready" } },
  search: "issuer=issuer-1&context=context-1&run=run-1",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("@/lib/engine/useModelAuthority", () => ({ useModelAuthority: () => state.authority }));
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/ShellIdentity", () => ({ ShellIdentity: () => null }));
vi.mock("@/components/shared/SurfaceState", () => ({ SurfaceState: () => <div>authority state</div> }));
vi.mock("./ModelV2Workbench", () => ({
  ModelV2Workbench: ({ issuerId }: { issuerId: string }) => <div>default v2 {issuerId}</div>,
}));
vi.mock("./LegacyCalculatorBridge", () => ({
  default: ({ children }: { children: (runtime: object) => React.ReactNode }) => <>{children({})}</>,
}));

afterEach(() => {
  cleanup();
  state.authority.mode = "v2-confirmed";
  state.search = "issuer=issuer-1&context=context-1&run=run-1";
});

describe("ModelAuthorityRoute default renderers", () => {
  it("renders the default v2 workbench", () => {
    render(<ModelAuthorityRoute />);
    expect(screen.getByText("default v2 issuer-1")).toBeTruthy();
  });

  it("keys the default v2 workbench against latest when no exact run is selected", () => {
    state.search = "issuer=issuer-1";
    render(<ModelAuthorityRoute />);
    expect(screen.getByText("default v2 issuer-1")).toBeTruthy();
  });

  it("invokes the default null legacy renderer", async () => {
    state.authority.mode = "legacy-confirmed";
    const { container } = render(<ModelAuthorityRoute />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});
