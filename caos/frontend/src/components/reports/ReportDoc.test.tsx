// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildReports } from "@/lib/reports/builders";
import { ReportDoc } from "./ReportDoc";

afterEach(cleanup);

describe("ReportDoc period groups", () => {
  it("renders stable group-start metadata on appendix headers and body cells", () => {
    const appendix = buildReports().find((report) => report.id === "model");
    if (!appendix) throw new Error("model appendix fixture is required");

    const { container } = render(<ReportDoc rep={appendix} />);
    const keys = ["Q", "YTD", "HIST", "LTM", "PF", "BASE", "DOWN"];
    for (const key of keys) {
      expect(container.querySelector(`th.rd-group-start[data-column-group="${key}"]`)).toBeTruthy();
      expect(container.querySelector(`td.rd-group-start[data-column-group="${key}"]`)).toBeTruthy();
    }
  });
});
