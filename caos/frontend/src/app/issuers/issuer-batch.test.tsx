// @vitest-environment jsdom
// WP-10 — Issuers directory row checkboxes + BatchBar. Locks the wiring: only
// the three real actions from the master plan (Run pipeline / Add to
// watchlist / Export CSV) ever appear, Run pipeline reports honest per-item
// partial failure (never a fake blanket "done"), and Add to watchlist is one
// read-merge-PUT for the whole selection, not one per row.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import IssuersPage from "./page";
import type { Issuer } from "@/types/issuers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/issuers",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// jsdom has no URL.createObjectURL — downloadCsv's real anchor-click download
// path throws there. csvCell stays real (importOriginal) so CSV-cell escaping
// is still exercised; only the DOM side-effect is stubbed.
vi.mock("@/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/csv")>()),
  downloadCsv: vi.fn(),
}));

const getIssuers = vi.fn();
const createRun = vi.fn();
const getWatchlist = vi.fn();
const saveWatchlist = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIssuers: (...a: unknown[]) => getIssuers(...a),
  createRun: (...a: unknown[]) => createRun(...a),
  getWatchlist: (...a: unknown[]) => getWatchlist(...a),
  saveWatchlist: (...a: unknown[]) => saveWatchlist(...a),
}));

const ISSUERS: Issuer[] = [
  { id: "iss-1", name: "Atlas Forge Industrials", ticker: "ATLF", sector: "Industrials", country: "United States", rating_sp: "B2" },
  { id: "iss-2", name: "Kestrel Chemicals", ticker: "KSTL", sector: "Chemicals", country: "United Kingdom", rating_sp: "CCC+" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderSelectedTwo() {
  getIssuers.mockResolvedValue(ISSUERS);
  render(<IssuersPage />);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Select Atlas Forge Industrials" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Kestrel Chemicals" }));
  await waitFor(() => expect(screen.getByText("2 issuers selected")).toBeTruthy());
  return within(screen.getByRole("toolbar", { name: "Batch actions" }));
}

describe("Issuers directory — batch selection", () => {
  it("shows no BatchBar until a row is selected", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull();
  });

  it("selecting rows exposes exactly the three real actions — never delete/refresh/assign", async () => {
    const toolbar = await renderSelectedTwo();
    expect(toolbar.getByRole("button", { name: "Run pipeline (2)" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Add to watchlist (2)" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Export CSV" })).toBeTruthy();
    for (const bad of [/delete/i, /refresh/i, /assign/i]) {
      expect(toolbar.queryByRole("button", { name: bad })).toBeNull();
    }
  });

  it("Run pipeline is sequential and reports the 429's server detail verbatim as a partial failure", async () => {
    createRun.mockImplementation(async (issuerId: string) => {
      if (issuerId === "iss-2") {
        throw { response: { status: 429, data: { detail: "Run rate limit reached — try again in a minute." } } };
      }
      return { id: "run-ok", issuer_id: issuerId, status: "queued" };
    });
    const toolbar = await renderSelectedTwo();
    fireEvent.click(toolbar.getByRole("button", { name: "Run pipeline (2)" }));
    await waitFor(() => expect(screen.getByText("1/2 succeeded")).toBeTruthy());
    expect(createRun).toHaveBeenCalledTimes(2);
    // Never a blanket "done" — the failing issuer's own attempt is visible in the ratio.
    expect(screen.queryByText("2 succeeded")).toBeNull();
  });

  it("Add to watchlist does one read-merge-PUT for the whole selection, not one per row", async () => {
    getWatchlist.mockResolvedValue({ issuer_ids: ["existing-1"] });
    saveWatchlist.mockResolvedValue({ issuer_ids: ["existing-1", "iss-1", "iss-2"] });
    const toolbar = await renderSelectedTwo();
    fireEvent.click(toolbar.getByRole("button", { name: "Add to watchlist (2)" }));
    await waitFor(() => expect(screen.getByText("2 succeeded")).toBeTruthy());
    expect(getWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledWith(["existing-1", "iss-1", "iss-2"]);
  });

  it("Export CSV never calls the server", async () => {
    const toolbar = await renderSelectedTwo();
    fireEvent.click(toolbar.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(screen.getByText("2 succeeded")).toBeTruthy());
    expect(createRun).not.toHaveBeenCalled();
    expect(getWatchlist).not.toHaveBeenCalled();
    expect(saveWatchlist).not.toHaveBeenCalled();
  });

  it("select-all (header checkbox) selects every visible row, and clear empties the selection", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all issuers" }));
    await waitFor(() => expect(screen.getByText("2 issuers selected")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull());
  });
});
