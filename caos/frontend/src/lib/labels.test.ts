import { describe, expect, it } from "vitest";
import { classificationLabel, recommendationLine } from "./labels";

describe("classificationLabel", () => {
  it("humanizes enum literals and passes unknowns through", () => {
    expect(classificationLabel("screen-only")).toBe("Screen-only");
    expect(classificationLabel("actionable")).toBe("Actionable");
    expect(classificationLabel("")).toBe("");
  });
});

describe("recommendationLine", () => {
  it("dedupes recommendation and classification that normalize equal", () => {
    expect(recommendationLine("Screen only", "screen-only")).toBe("Screen-only");
    expect(recommendationLine("SCREEN ONLY", "screen-only")).toBe("Screen-only");
  });
  it("keeps genuinely different tokens as a pair", () => {
    expect(recommendationLine("Buy", "actionable")).toBe("Buy · Actionable");
  });
});
