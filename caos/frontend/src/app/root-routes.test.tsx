// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import Home from "./page";
import ProfileRoute from "./issuers/profile/page";
import ProfileContent from "./issuers/profile/ProfileContent";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: "analyst", ready: true }),
}));
vi.mock("./issuers/profile/ProfileContent", () => ({ default: function MockProfileContent() { return null; } }));

describe("thin route entrypoints", () => {
  it("routes a ready analyst root visit to the issuer worklist", async () => {
    render(<Home />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/issuers"));
  });

  it("re-exports the issuer profile implementation", () => {
    expect(ProfileRoute).toBe(ProfileContent);
  });
});
