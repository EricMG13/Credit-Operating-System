// @vitest-environment jsdom
// G5: Sector RV now opens with the shared DecisionHeader, summarizing the
// SAME top-ranked dislocation ActionableDislocations opens with — locks that
// the two can never disagree, and that the evidence-health cell carries the
// same REFERENCE/DERIVED/freshness grammar as that panel's own chip.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SectorRvPage from "./page";
import { PORTFOLIO } from "@/lib/command/data";
import { buildRVHoldingsMap, buildRVRows } from "@/lib/command/rvdata";
import { rankDislocations } from "@/lib/command/dislocations";

vi.mock("next/navigation", () => ({
  usePathname: () => "/sector-rv",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getPortfolio: vi.fn().mockRejectedValue(new Error("network error")),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sector RV · DecisionHeader (G5)", () => {
  it("opens with the same top dislocation ActionableDislocations ranks first", async () => {
    // Offline (getPortfolio rejected) → the page falls back to the static
    // PORTFOLIO sleeve, exactly like ActionableDislocations/SectorRV do.
    const holdings = buildRVHoldingsMap(PORTFOLIO);
    const top = rankDislocations(buildRVRows(holdings), 1)[0];
    expect(top).toBeTruthy();

    render(<SectorRvPage />);

    const header = await screen.findByLabelText("Decision header");
    fireEvent.click(header.querySelector("button")!);

    const sign = top.rvBp > 0 ? "+" : "";
    expect(header.textContent).toContain(top.company);
    expect(header.textContent).toContain(`${sign}${Math.round(top.rvBp)}bp`);
    // Evidence-health cell renders the shared ProvenanceChip — same visible
    // REFERENCE/DERIVED grammar as ActionableDislocations' own chip.
    expect(header.textContent).toContain("REFERENCE");
    expect(header.textContent).toContain("DERIVED");
  });
});
