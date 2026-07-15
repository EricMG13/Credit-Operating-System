import { describe, expect, it } from "vitest";
import { fmtLocalDateTime, fmtUtcDate, fmtUtcDateTime } from "./format-date";

describe("fmtUtcDateTime", () => {
  it("formats a microsecond ISO string as a UTC desk stamp", () => {
    expect(fmtUtcDateTime("2026-07-15T19:27:30.927734Z")).toBe("2026-07-15 19:27 UTC");
  });

  it("formats Date and epoch inputs", () => {
    expect(fmtUtcDateTime(new Date(Date.UTC(2026, 6, 6, 0, 0, 0)))).toBe("2026-07-06 00:00 UTC");
    expect(fmtUtcDateTime(Date.UTC(2026, 0, 2, 23, 59))).toBe("2026-01-02 23:59 UTC");
  });

  it("renders an em dash for invalid/null/empty input", () => {
    expect(fmtUtcDateTime(null)).toBe("—");
    expect(fmtUtcDateTime(undefined)).toBe("—");
    expect(fmtUtcDateTime("")).toBe("—");
    expect(fmtUtcDateTime("not-a-date")).toBe("—");
  });
});

describe("fmtUtcDate", () => {
  it("formats ISO date and datetime inputs as YYYY-MM-DD", () => {
    expect(fmtUtcDate("2026-05-31")).toBe("2026-05-31");
    expect(fmtUtcDate("2026-07-15T19:27:30.927734Z")).toBe("2026-07-15");
  });

  it("renders an em dash for invalid input", () => {
    expect(fmtUtcDate("reference fixture")).toBe("—");
    expect(fmtUtcDate(null)).toBe("—");
  });
});

describe("fmtLocalDateTime", () => {
  it("is locale-pinned with an injectable timezone", () => {
    const iso = "2026-07-15T18:05:00Z";
    expect(fmtLocalDateTime(iso, { timeZone: "UTC" })).toBe("15 Jul 2026, 18:05");
    expect(fmtLocalDateTime(iso, { timeZone: "America/New_York" })).toBe("15 Jul 2026, 14:05");
  });

  it("renders an em dash for invalid input", () => {
    expect(fmtLocalDateTime("nope")).toBe("—");
  });
});
