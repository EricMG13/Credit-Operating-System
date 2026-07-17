// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IssuerLink } from "./IssuerLink";

const overlay = vi.hoisted(() => ({ openProfile: vi.fn(), openProfileByQuery: vi.fn() }));
vi.mock("./IssuerProfileOverlay", () => ({ useIssuerProfileOverlay: () => overlay }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IssuerLink", () => {
  it("opens by text query and stops activation-key propagation", () => {
    const parent = vi.fn();
    render(<div onClick={parent}><IssuerLink query="Atlas Forge">Atlas</IssuerLink></div>);
    const link = screen.getByRole("link", { name: "Atlas" });
    fireEvent.keyDown(link, { key: "Enter" });
    fireEvent.keyDown(link, { key: "Tab" });
    fireEvent.click(link);
    expect(overlay.openProfileByQuery).toHaveBeenCalledWith("Atlas Forge");
    expect(parent).not.toHaveBeenCalled();
  });

  it("uses an empty search href and performs no overlay action without identity", () => {
    render(<IssuerLink>Unknown</IssuerLink>);
    const link = screen.getByRole("link", { name: "Unknown" });
    expect(link.getAttribute("href")).toContain("/issuers");
    fireEvent.click(link);
    expect(overlay.openProfile).not.toHaveBeenCalled();
    expect(overlay.openProfileByQuery).not.toHaveBeenCalled();
  });
});
