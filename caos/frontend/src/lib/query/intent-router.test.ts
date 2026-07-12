import { describe, expect, it } from "vitest";
import { classifyIntent } from "./intent-router";

describe("classifyIntent", () => {
  it("empty input defaults to the graph lane", () => {
    expect(classifyIntent("", { metricLaneAvailable: true }).lane).toBe("graph");
    expect(classifyIntent("   ", { metricLaneAvailable: true }).lane).toBe("graph");
  });

  it("relationship/provenance language always wins the graph lane, even over metric shape", () => {
    const choice = classifyIntent("rank the peers of this issuer by leverage", { metricLaneAvailable: true });
    expect(choice.lane).toBe("graph");
    expect(choice.reason).toMatch(/relationship/);
  });

  it("ranking/comparator/threshold language routes to metric when the lane is available", () => {
    expect(classifyIntent("which issuers are most levered", { metricLaneAvailable: true }).lane).toBe("metric");
    expect(classifyIntent("net_leverage > 6", { metricLaneAvailable: true }).lane).toBe("metric");
    expect(classifyIntent("issuers with coverage below 2x", { metricLaneAvailable: true }).lane).toBe("metric");
    expect(classifyIntent("issuers where dm is highest", { metricLaneAvailable: true }).lane).toBe("metric");
  });

  it("never routes into the metric lane when the model lane is unavailable, even for metric-shaped text", () => {
    const choice = classifyIntent("which issuers are most levered", { metricLaneAvailable: false });
    expect(choice.lane).toBe("graph");
  });

  it("unmatched text defaults to the graph lane", () => {
    expect(classifyIntent("tell me about this company", { metricLaneAvailable: true }).lane).toBe("graph");
  });
});
