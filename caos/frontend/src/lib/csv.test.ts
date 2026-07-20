// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { csvCell, downloadCsv } from "./csv";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("csvCell", () => {
  it("renders nullish, finite, non-finite, and ordinary scalar values", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe("");
    expect(csvCell(true)).toBe("true");
    expect(csvCell("ordinary text")).toBe("ordinary text");
  });

  it.each(["=SUM(A1:A2)", "+cmd", "-cmd", "@cmd", "\tpaste", "\rformula"])(
    "neutralizes spreadsheet formula input %j",
    (value) => expect(csvCell(value)).toBe(`'${value}`),
  );

  it("quotes delimiters, newlines, and embedded quotes after neutralization", () => {
    expect(csvCell("Atlas, Forge")).toBe('"Atlas, Forge"');
    expect(csvCell('Atlas "Forge"')).toBe('"Atlas ""Forge"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("\n=cmd")).toBe('"\'\n=cmd"');
    expect(csvCell('=HYPERLINK("evil", "open")')).toBe('"\'=HYPERLINK(""evil"", ""open"")"');
  });
});

describe("downloadCsv", () => {
  it("downloads a UTF-8 CSV blob and revokes its temporary URL", () => {
    const createObjectURL = vi.fn<typeof URL.createObjectURL>(() => "blob:csv-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadCsv("issuers.csv", "issuer,value\nAtlas,100");

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURL.mock.calls[0][0];
    if (!(blob instanceof Blob)) {
      throw new TypeError("CSV export did not create a Blob");
    }
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv-export");
  });
});
