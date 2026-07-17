// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getIssuerProfile, getIssuers } = vi.hoisted(() => ({
  getIssuerProfile: vi.fn(),
  getIssuers: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ getIssuerProfile, getIssuers }));
vi.mock("@/app/issuers/profile/ProfileContent", () => ({
  Profile: ({ id, onClose }: { id: string; onClose: () => void }) => <div>profile {id}<button onClick={onClose}>profile close</button></div>,
}));
vi.mock("@/lib/use-modal-a11y", () => ({ useModalA11y: () => ({ current: null }), hasOpenModalA11yOverlay: () => false }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

import { DEMO_UNIVERSE } from "@/lib/issuers";
import { IssuerProfileOverlay, IssuerProfileOverlayProvider, useIssuerProfileOverlay } from "./IssuerProfileOverlay";

function Controls() {
  const overlay = useIssuerProfileOverlay();
  return <>
    <button onClick={() => overlay.openProfile("   ")}>blank direct</button>
    <button onClick={() => overlay.openProfile(" issuer-1 ")}>open direct</button>
    <button onClick={() => void overlay.openProfileByQuery("   ")}>blank query</button>
    <button onClick={() => void overlay.openProfileByQuery("ABC")}>server query</button>
    <button onClick={() => void overlay.openProfileByQuery(DEMO_UNIVERSE[0]?.ticker ?? DEMO_UNIVERSE[0]?.name ?? "demo")}>demo query</button>
    <button onClick={() => void overlay.openProfileByQuery("unknown issuer")}>unknown query</button>
    <span data-testid="overlay-state">{String(overlay.isOpen)}:{overlay.issuerId ?? "none"}</span>
  </>;
}

function Harness() {
  return <IssuerProfileOverlayProvider><Controls /><IssuerProfileOverlay /></IssuerProfileOverlayProvider>;
}

beforeEach(() => {
  getIssuerProfile.mockResolvedValue({});
  getIssuers.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("IssuerProfileOverlay", () => {
  it("opens a direct profile, renders it, closes it, and yields to another modal", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "blank direct" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "open direct" }));
    expect(await screen.findByText("profile issuer-1")).toBeTruthy();
    expect(getIssuerProfile).toHaveBeenCalledWith("issuer-1");
    fireEvent.click(screen.getByRole("button", { name: "profile close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "open direct" }));
    await screen.findByRole("dialog");
    window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "another-modal" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resolves exact server matches and ignores blank queries", async () => {
    getIssuers.mockResolvedValueOnce([{ id: "server-1", name: "Acme", ticker: "ABC" }]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "blank query" }));
    expect(getIssuers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "server query" }));
    expect(await screen.findByText("profile server-1")).toBeTruthy();
  });

  it("falls back to the local sleeve and then to the raw query", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getIssuers.mockRejectedValueOnce(new Error("offline"));
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "demo query" }));
    expect(await screen.findByText(`profile ${DEMO_UNIVERSE[0].id}`)).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "profile close" }));

    getIssuers.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "unknown query" }));
    expect(await screen.findByText("profile unknown issuer")).toBeTruthy();
  });

  it("renders 404 and generic profile errors with recovery actions", async () => {
    getIssuerProfile.mockRejectedValueOnce({ response: { status: 404 } });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open direct" }));
    expect(await screen.findByText("Issuer not found.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Deep-Dive" }).getAttribute("href")).toBe("/deepdive?issuer=issuer-1");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    cleanup();
    getIssuerProfile.mockRejectedValueOnce({ response: { status: 500, data: { detail: "Profile exploded" } } });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open direct" }));
    expect(await screen.findByText("Profile exploded")).toBeTruthy();
  });
});
