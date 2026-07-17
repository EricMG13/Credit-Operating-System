import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createRun = vi.fn();
const getWatchlist = vi.fn();
const saveWatchlist = vi.fn();
const downloadCsv = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createRun: (...a: unknown[]) => createRun(...a),
  getWatchlist: (...a: unknown[]) => getWatchlist(...a),
  saveWatchlist: (...a: unknown[]) => saveWatchlist(...a),
}));
vi.mock("@/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/csv")>()),
  downloadCsv: (...a: unknown[]) => downloadCsv(...a),
}));

import { addToWatchlistAction, exportCsvAction, issuersToCsv, runPipelineAction } from "./batchActions";
import type { Issuer } from "@/types/issuers";

const ISSUERS: Issuer[] = [
  {
    id: "iss-1", name: "Atlas Forge Industrials", ticker: "ATLF", sector: "Industrials",
    sub_sector: "Engineered Components", country: "United States", rating_sp: "B2",
  },
  {
    id: "iss-2", name: "Kestrel Chemicals, Inc.", ticker: "KSTL", sector: "Chemicals",
    sub_sector: null, country: "United Kingdom", rating_sp: null,
  },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("runPipelineAction", () => {
  it("labels the button with the selection count", () => {
    expect(runPipelineAction(3).label).toBe("Run pipeline (3)");
  });

  it("posts one run per issuer with a distinct Idempotency-Key each", async () => {
    createRun.mockResolvedValue({ id: "run-1", issuer_id: "iss-1", status: "queued" });
    const action = runPipelineAction(2);
    await action.run("iss-1");
    await action.run("iss-2");
    expect(createRun).toHaveBeenCalledTimes(2);
    const [key1] = [createRun.mock.calls[0][3]];
    const [key2] = [createRun.mock.calls[1][3]];
    expect(typeof key1).toBe("string");
    expect(key1).not.toBe("");
    expect(key1).not.toBe(key2);
    expect(createRun.mock.calls[0][0]).toBe("iss-1");
    expect(createRun.mock.calls[1][0]).toBe("iss-2");
  });

  it("surfaces a 429's server detail VERBATIM — never a generic 'failed'", async () => {
    createRun.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 429",
      response: { status: 429, data: { detail: "Run rate limit reached — try again in a minute." } },
    });
    const action = runPipelineAction(1);
    await expect(action.run("iss-1")).rejects.toThrow("Run rate limit reached — try again in a minute.");
  });

  it("one issuer's 429 doesn't stop another issuer's run from being attempted", async () => {
    createRun.mockImplementation(async (issuerId: string) => {
      if (issuerId === "iss-2") {
        const err = { response: { status: 429, data: { detail: "Run rate limit reached — try again in a minute." } } };
        throw err;
      }
      return { id: "run-1", issuer_id: issuerId, status: "queued" };
    });
    const action = runPipelineAction(2);
    await expect(action.run("iss-1")).resolves.toBeUndefined();
    await expect(action.run("iss-2")).rejects.toThrow("Run rate limit reached — try again in a minute.");
  });
});

describe("addToWatchlistAction", () => {
  it("does ONE read-merge-PUT for the whole batch, not one per selected id", async () => {
    getWatchlist.mockResolvedValue({ issuer_ids: ["existing-1"] });
    saveWatchlist.mockResolvedValue({ issuer_ids: ["existing-1", "iss-1", "iss-2"] });
    const action = addToWatchlistAction(["iss-1", "iss-2"]);

    // BatchBar calls run(id) once per selected id, sequentially — the SAME
    // shared promise must answer every call, not trigger a fresh GET+PUT.
    await Promise.all([action.run("iss-1"), action.run("iss-2")]);

    expect(getWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledWith(["existing-1", "iss-1", "iss-2"]);
  });

  it("dedupes ids already on the watchlist", async () => {
    getWatchlist.mockResolvedValue({ issuer_ids: ["iss-1"] });
    saveWatchlist.mockResolvedValue({ issuer_ids: ["iss-1", "iss-2"] });
    const action = addToWatchlistAction(["iss-1", "iss-2"]);
    await action.run("iss-1");
    expect(saveWatchlist).toHaveBeenCalledWith(["iss-1", "iss-2"]);
  });

  it("a merge failure rejects every id's run() with the same verbatim message — never a fake partial success", async () => {
    getWatchlist.mockResolvedValue({ issuer_ids: [] });
    saveWatchlist.mockRejectedValue({
      response: { status: 500, data: { detail: "Couldn't reach the watchlist store." } },
    });
    const action = addToWatchlistAction(["iss-1", "iss-2"]);
    await expect(action.run("iss-1")).rejects.toThrow("Couldn't reach the watchlist store.");
    await expect(action.run("iss-2")).rejects.toThrow("Couldn't reach the watchlist store.");
    expect(getWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledTimes(1);
  });
});

describe("issuersToCsv", () => {
  it("emits the register's visible columns, comma-escaping names with commas", () => {
    const csv = issuersToCsv(ISSUERS);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Ticker,Issuer,Rating,Sector,Sub-sector,Country");
    expect(lines[1]).toBe("ATLF,Atlas Forge Industrials,B2,Industrials,Engineered Components,United States");
    expect(lines[2]).toBe('KSTL,"Kestrel Chemicals, Inc.",,Chemicals,,United Kingdom');
  });

  it("emits an empty ticker for issuers without one", () => {
    const row = issuersToCsv([{ ...ISSUERS[0], ticker: undefined, country: undefined }]).split("\n")[1];
    expect(row).toMatch(/^,/);
    expect(row).toMatch(/,$/);
  });
});

describe("exportCsvAction", () => {
  it("is pure client-side — no api call — and downloads exactly once for the whole batch", async () => {
    const action = exportCsvAction(ISSUERS);
    await action.run("iss-1");
    await action.run("iss-2");
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    expect(createRun).not.toHaveBeenCalled();
    expect(getWatchlist).not.toHaveBeenCalled();
    expect(saveWatchlist).not.toHaveBeenCalled();
    const [filename, content] = downloadCsv.mock.calls[0];
    expect(filename).toMatch(/^caos-issuers-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content).toContain("Atlas Forge Industrials");
    expect(content).toContain("Kestrel Chemicals, Inc.");
  });
});
