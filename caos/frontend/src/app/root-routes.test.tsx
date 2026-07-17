// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import Home from "./page";
import ProfileRoute from "./issuers/profile/page";
import ProfileContent from "./issuers/profile/ProfileContent";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./issuers/profile/ProfileContent", () => ({ default: function MockProfileContent() { return null; } }));

describe("thin route entrypoints", () => {
  it("redirects the root route to the issuer worklist", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/issuers");
  });

  it("re-exports the issuer profile implementation", () => {
    expect(ProfileRoute).toBe(ProfileContent);
  });
});
