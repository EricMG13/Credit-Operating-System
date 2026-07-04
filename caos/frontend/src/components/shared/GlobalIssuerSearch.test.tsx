// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// Mock the one API fn (GET /api/issuers?q=) and the overlay context hook.
vi.mock("@/lib/api", () => ({ getIssuers: vi.fn() }));
vi.mock("@/components/shared/IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => ({ openProfile: vi.fn() }),
}));

import { GlobalIssuerSearch } from "./GlobalIssuerSearch";
import { getIssuers } from "@/lib/api";

const mockGetIssuers = vi.mocked(getIssuers);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GlobalIssuerSearch", () => {
  it("shows a distinct error state on a failed search, not a silent empty (SEAM3-6)", async () => {
    mockGetIssuers.mockRejectedValue(new Error("500"));
    render(<GlobalIssuerSearch />);

    fireEvent.change(screen.getByLabelText("Global issuer search"), { target: { value: "acme" } });

    // A failed lookup must surface as an alert — not read as "no such issuer".
    const alert = await waitFor(() => screen.getByRole("alert"));
    expect(alert.textContent).toMatch(/unavailable/i);
  });

  it("shows results (no error row) on a successful search", async () => {
    mockGetIssuers.mockResolvedValue([
      { id: "i1", name: "Acme Corp", ticker: "ACM", sector: "Industrials" },
    ] as never);
    render(<GlobalIssuerSearch />);

    fireEvent.change(screen.getByLabelText("Global issuer search"), { target: { value: "acme" } });

    expect(await waitFor(() => screen.getByText("Acme Corp"))).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
