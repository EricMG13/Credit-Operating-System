import { describe, expect, it } from "vitest";
import { QUESTIONS, questionFor, questionGroups } from "./questions";
import type { CapabilitiesResult, Capability } from "./graph";

const cap = (id: string, enabled = true): Capability => ({
  id, label: id, mode: "peers", enabled, reason: enabled ? null : "needs a completed run",
});

const caps = (ids: string[]): CapabilitiesResult => ({
  groups: [{ id: "g", label: "G", icon: "", ready: ids.length, total: ids.length, capabilities: ids.map((i) => cap(i)) }],
  availability: {},
});

describe("questionGroups", () => {
  it("remaps engine groups into analyst jobs, in job order", () => {
    const g = questionGroups(caps(["peer-set", "contagion", "trace-source", "open-findings"]));
    expect(g.map((x) => x.id)).toEqual(["position", "exposure", "defend", "watch"]);
    expect(g[0].capabilities[0].id).toBe("peer-set");
  });

  it("unmapped capabilities land in watch instead of disappearing", () => {
    const g = questionGroups(caps(["brand-new-walk"]));
    expect(g).toHaveLength(1);
    expect(g[0].id).toBe("watch");
    expect(g[0].capabilities[0].id).toBe("brand-new-walk");
  });

  it("ready counts only enabled capabilities", () => {
    const c = caps(["peer-set"]);
    c.groups[0].capabilities.push(cap("distribution", false));
    const g = questionGroups(c);
    expect(g[0].ready).toBe(1);
    expect(g[0].total).toBe(2);
  });

  it("null caps → empty", () => {
    expect(questionGroups(null)).toEqual([]);
  });
});

describe("questionFor", () => {
  it("uses the question phrasing when mapped, engine label otherwise", () => {
    expect(questionFor(cap("peer-set"))).toBe(QUESTIONS["peer-set"].q);
    expect(questionFor(cap("mystery"))).toBe("mystery");
  });
});
