import { describe, it, expect } from "vitest";
import { refreshOutcome, SECTOR_REVIEWS, type KnowledgeSource } from "./srdata";

const src = (reachable?: boolean): KnowledgeSource => ({
  kind: "external",
  name: "s",
  detail: "d",
  ...(reachable === undefined ? {} : { reachable }),
});

describe("refreshOutcome", () => {
  it("all sources reachable → full, not partial", () => {
    const out = refreshOutcome([src(), src(true), src()], false);
    expect(out).toEqual({ reached: 3, total: 3, partial: false });
  });

  it("an unreachable source degrades to partial", () => {
    const out = refreshOutcome([src(), src(false), src()], false);
    expect(out).toEqual({ reached: 2, total: 3, partial: true });
  });

  it("retry re-attempts every source → full, not partial", () => {
    const out = refreshOutcome([src(), src(false), src(false)], true);
    expect(out).toEqual({ reached: 3, total: 3, partial: false });
  });

  it("empty source set is trivially complete", () => {
    expect(refreshOutcome([], false)).toEqual({ reached: 0, total: 0, partial: false });
  });

  it("at least one sector carries an unreachable source so the partial path is live, not dead code", () => {
    const anyPartial = Object.values(SECTOR_REVIEWS).some(
      (s) => refreshOutcome(s.sources, false).partial,
    );
    expect(anyPartial).toBe(true);
  });
});
