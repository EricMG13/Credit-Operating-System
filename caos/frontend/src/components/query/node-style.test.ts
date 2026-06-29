import { describe, expect, it } from "vitest";
import { hueFor, nodeStyle } from "./node-style";
import { CHART_HEX } from "@/lib/chart-colors";
import type { GraphNode } from "@/lib/query/graph";

const node = (kind: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id: "n", label: "L", kind, x: 0, y: 0, ...extra,
});

describe("hueFor", () => {
  it("is the neutral gray for no group", () => {
    expect(hueFor(null)).toBe("var(--caos-muted)");
    expect(hueFor(undefined)).toBe("var(--caos-muted)");
    expect(hueFor("")).toBe("var(--caos-muted)");
  });
  it("is deterministic per group string", () => {
    expect(hueFor("Telecom")).toBe(hueFor("Telecom"));
  });
});

describe("nodeStyle — shape resolution", () => {
  it("compact wins regardless of kind (small dot)", () => {
    const s = nodeStyle(node("sector", { compact: true }));
    expect(s.shape).toBe("compact");
    expect(s.r).toBe(6);
    expect(s.sw).toBe(1.4);
  });
  it("center → circle, accent stroke (warning when flagged)", () => {
    expect(nodeStyle(node("center")).shape).toBe("circle");
    expect(nodeStyle(node("center")).stroke).toBe(CHART_HEX.accent);
    expect(nodeStyle(node("center", { flag: true })).stroke).toBe(CHART_HEX.warning);
    expect(nodeStyle(node("center")).r).toBe(19);
    expect(nodeStyle(node("center")).isCircle).toBe(true);
  });
  it("issuer → circle, exposed thickens stroke + warns", () => {
    const plain = nodeStyle(node("issuer", { group: "Telecom" }));
    expect(plain.shape).toBe("circle");
    expect(plain.sw).toBe(1.8);
    expect(plain.stroke).toBe(hueFor("Telecom"));
    const exposed = nodeStyle(node("issuer", { group: "Telecom", exposed: true }));
    expect(exposed.sw).toBe(2.4);
    expect(exposed.stroke).toBe(CHART_HEX.warning);
  });
  it("sector → pill, color by group (warning when flagged)", () => {
    expect(nodeStyle(node("sector", { group: "Energy" })).shape).toBe("pill");
    expect(nodeStyle(node("sector", { group: "Energy" })).color).toBe(hueFor("Energy"));
    expect(nodeStyle(node("sector", { group: "Energy", flag: true })).color).toBe(CHART_HEX.warning);
  });
  it("known kind → rect tinted from the KIND palette", () => {
    const s = nodeStyle(node("driver"));
    expect(s.shape).toBe("rect");
    expect(s.fill).toBe("rgba(245, 165, 36, 0.15)");
    expect(s.stroke).toBe(CHART_HEX.warning);
    expect(s.r).toBe(13);
  });
  it("unknown kind → rect with default fill/stroke", () => {
    const s = nodeStyle(node("mystery"));
    expect(s.shape).toBe("rect");
    expect(s.fill).toBe("var(--caos-panel)");
    expect(s.stroke).toBe("var(--caos-border)");
  });
  it("flagged rect overrides stroke to warning", () => {
    expect(nodeStyle(node("claim", { flag: true })).stroke).toBe(CHART_HEX.warning);
  });
  it("isMono only for claim/evidence/metric/module", () => {
    for (const k of ["claim", "evidence", "metric", "module"]) expect(nodeStyle(node(k)).isMono).toBe(true);
    for (const k of ["driver", "chunk", "issuer", "sector"]) expect(nodeStyle(node(k)).isMono).toBe(false);
  });
});
