// @vitest-environment jsdom
// Locks in the distilled Profile contract: one layout, one primary action
// (header OPEN DEEP-DIVE), issuer-scoped jumps in the static bottom bar,
// ratings shown once (header), no layout switcher / hidden shortcuts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Profile } from "./ProfileContent";
import type { IssuerProfile } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: () => "/issuers/profile",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIssuerProfile: vi.fn(),
  queryGraph: vi.fn().mockResolvedValue({
    capability_id: "analyst-memos", mode: "provenance", title: "",
    nodes: [], edges: [], meta: [], caveats: [],
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const data: IssuerProfile = {
  issuer: {
    id: "iss-1", name: "VMO2", ticker: "VMO2", sector: "Telecom",
    country: "United Kingdom", rating_sp: "BB-", rating_moody: "B1", rating_fitch: "BB",
  },
  latest_run: {
    id: "run-1", status: "complete", qa_status: "Passed", committee_status: "Committee Ready",
    as_of_date: "2026-06-30", analyst_id: "eg", model_mode: null,
    created_at: "2026-06-30T10:00:00Z", completed_at: "2026-06-30T10:05:00Z",
  },
  runs: [],
  metrics: [{
    metric_key: "net_leverage", period: "FY2025", value: 5.2, unit: "x", basis: null,
    provenance: "run", headline: true, qa_status: "Passed",
    source_claim_id: null, source_evidence_id: null, document_chunk_id: null,
  }],
  signals: {}, coverage: {}, findings: {}, business: [], sponsor: {},
  strengths: [], weaknesses: [],
  earnings: {
    latest_period: null, prior_period: null, revenue_growth_pct: null,
    ebitda_growth_pct: null, margin_change_pp: null, monitoring_signals: [],
  },
};

describe("Profile (distilled)", () => {
  it("renders one layout with a single primary Deep-Dive action and the issuer action bar", () => {
    render(<Profile id="iss-1" data={data} />);

    // Single primary action, in the header.
    const deepDive = screen.getAllByRole("link", { name: "OPEN DEEP-DIVE →" });
    expect(deepDive).toHaveLength(1);
    expect(deepDive[0].getAttribute("href")).toBe("/deepdive?issuer=iss-1");

    // Issuer-scoped jumps live in the bottom bar, carrying ?issuer=.
    for (const [label, path] of [
      ["Run analysis", "/pipeline"], ["Model Builder", "/model"],
      ["Report Studio", "/reports"], ["Upload docs", "/upload"],
    ] as const) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(path + "?issuer=iss-1");
    }

    // Dual layout, its switcher, and the shortcut chip are gone.
    expect(screen.queryByText(/Bloomberg/)).toBeNull();
    expect(screen.queryByText(/Unified Workspace/)).toBeNull();
    expect(screen.queryByText(/Alt\+/)).toBeNull();

    // All three agency ratings render once, in the header.
    for (const rating of ["BB-", "B1", "BB"]) {
      expect(screen.getAllByText(rating)).toHaveLength(1);
    }
    expect(screen.queryByText("Credit Ratings")).toBeNull();

    // Snapshot metric tile still renders with its formatted value. The metric
    // also appears as a trend small-multiple card (snapshot value + trend), so
    // allow the deliberate duplicate.
    expect(screen.getAllByText("Net leverage").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5.2×").length).toBeGreaterThanOrEqual(1);
  });
});
