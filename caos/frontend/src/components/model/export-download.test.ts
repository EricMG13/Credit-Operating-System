// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "@/lib/reports/assumptions";
import { buildModel } from "@/lib/reports/model";
import { exportModel } from "./export";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("exportModel", () => {
  it("serializes the workbook through a temporary xlsx download", async () => {
    const createObjectURL = vi.fn(() => "blob:model-workbook");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let clickedHref = "";
    let clickedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedHref = this.href;
      clickedDownload = this.download;
    });

    await exportModel(
      buildModel(1),
      false,
      {},
      { header: "Acme model", subheader: "FY25 · $m", filename: "acme-model.xlsx" },
      {
        prov: { origin: "LIVE", method: "REPORTED", asOf: "2026-07-19" },
        assumptions: DEFAULT_ASSUMPTIONS,
        metrics: [],
      },
    );

    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
    expect(clickedHref).toBe("blob:model-workbook");
    expect(clickedDownload).toBe("acme-model.xlsx");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:model-workbook");
  });
});
