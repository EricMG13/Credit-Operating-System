import { describe, expect, it } from "vitest";
import {
  dataModeFromSearch,
  preserveDataModeInHref,
  withDataMode,
} from "./data-mode";

describe("data mode URL contract", () => {
  it("defaults to live and accepts only the exact reference value", () => {
    expect(dataModeFromSearch("")).toBe("live");
    expect(dataModeFromSearch("?mode=live")).toBe("live");
    expect(dataModeFromSearch("?mode=REFERENCE")).toBe("live");
    expect(dataModeFromSearch("?mode=reference-preview")).toBe("live");
    expect(dataModeFromSearch("?mode=reference")).toBe("reference");
  });

  it("preserves path, unrelated query state, and hash without duplicate mode keys", () => {
    const reference = withDataMode(
      "/deepdive?issuer=iss-1&run=run-2&context=ctx&mode=live&mode=reference#E-103",
      "reference",
    );
    expect(reference).toBe("/deepdive?issuer=iss-1&run=run-2&context=ctx&mode=reference#E-103");
    expect(new URL(reference, "https://caos.test").searchParams.getAll("mode")).toEqual(["reference"]);

    expect(withDataMode(reference, "live")).toBe(
      "/deepdive?issuer=iss-1&run=run-2&context=ctx#E-103",
    );
  });

  it("projects the current reference mode into workflow and utility destinations only", () => {
    expect(preserveDataModeInHref("/reports?context=ctx#page-2", "?mode=reference&issuer=iss-1"))
      .toBe("/reports?context=ctx&mode=reference#page-2");
    expect(preserveDataModeInHref("/settings?tab=research", "?issuer=iss-1"))
      .toBe("/settings?tab=research");
  });
});
