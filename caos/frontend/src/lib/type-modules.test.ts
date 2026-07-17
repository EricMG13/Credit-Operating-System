import { describe, expect, it } from "vitest";

describe("type-only contract modules", () => {
  it("remain valid runtime modules for dynamic consumers", async () => {
    expect(Object.keys(await import("./decision-state"))).toEqual([]);
    expect(Object.keys(await import("./query/graph"))).toEqual([]);
  });
});
