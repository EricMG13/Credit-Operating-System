import { describe, expect, it } from "vitest";
import {
  ALL_ANALYSIS_SURFACES,
  PERSONA_COMPOSITIONS,
  PERSONAS,
  type PersonaLens,
  type SurfaceComposition,
  getSurfaceComposition,
} from "./persona-composition";

const legacyCompatibleComposition: SurfaceComposition = {
  surface: "command",
  persona: "analyst",
  slotOrder: ["primary"],
  dominantRepresentation: "table",
  defaultOpenPanels: ["primary"],
  summaryDensity: "detailed",
  emphasizedSlot: "primary",
  summaryLimit: null,
};

describe("persona composition registry", () => {
  it("covers every analysis surface for every presentation persona", () => {
    expect(Object.keys(PERSONA_COMPOSITIONS).sort()).toEqual(
      [...ALL_ANALYSIS_SURFACES].sort(),
    );

    for (const surface of ALL_ANALYSIS_SURFACES) {
      for (const persona of PERSONAS) {
        const composition = getSurfaceComposition(surface, persona);
        expect(composition.surface).toBe(surface);
        expect(composition.persona).toBe(persona);
        expect(composition.slotOrder).toContain("primary");
        expect(new Set(composition.slotOrder).size).toBe(composition.slotOrder.length);
      }
    }
  });

  it("keeps role changes presentational and preserves specialist representations", () => {
    const representations: SurfaceComposition["dominantRepresentation"][] = [
      "table", "document", "model", "graph", "canvas",
    ];
    const densities: SurfaceComposition["summaryDensity"][] = [
      "compact", "standard", "detailed",
    ];
    const panels: SurfaceComposition["defaultOpenPanels"] = ["primary", "custom-domain-panel"];
    const lens: PersonaLens = "analyst";
    expect(representations).toHaveLength(5);
    expect(densities).toHaveLength(3);
    expect(panels).toContain("custom-domain-panel");
    expect(lens).toBe("analyst");
    expect(legacyCompatibleComposition.leadingDataset).toBeUndefined();
    expect(legacyCompatibleComposition.actionPriority).toBeUndefined();
    expect(getSurfaceComposition("model", "pm").dominantRepresentation).toBe("model");
    expect(getSurfaceComposition("reports", "qa").dominantRepresentation).toBe("document");
    expect(getSurfaceComposition("pipeline", "pm").dominantRepresentation).toBe("graph");
    expect(getSurfaceComposition("query", "analyst").dominantRepresentation).toBe("graph");
    expect(getSurfaceComposition("issuers", "analyst").tableColumnPreset).toBeUndefined();
    expect(getSurfaceComposition("issuers", "analyst").actionPriority).toBeUndefined();
    expect("tablePreset" in getSurfaceComposition("issuers", "analyst")).toBe(false);
  });

  it("defines surface-specific analyst, PM, and QA operating compositions", () => {
    expect(getSurfaceComposition("command", "analyst")).toMatchObject({
      emphasizedSlot: "primary",
      leadingDataset: "coverage",
      summaryLimit: null,
      summaryDensity: "detailed",
      tableColumnPreset: undefined,
    });
    expect(getSurfaceComposition("command", "pm")).toMatchObject({
      emphasizedSlot: "decision",
      leadingDataset: "changes",
      summaryLimit: 4,
      summaryDensity: "compact",
      tableColumnPreset: "pm-delta",
    });
    expect(getSurfaceComposition("monitor", "qa")).toMatchObject({
      emphasizedSlot: "inspector",
      leadingDataset: "governance",
      summaryDensity: "standard",
      tableColumnPreset: "qa-gates",
    });
    expect(getSurfaceComposition("monitor", "qa").defaultOpenPanels).toContain("inspector");
    expect(getSurfaceComposition("monitor", "pm").defaultOpenPanels).not.toContain("context");
    expect(getSurfaceComposition("monitor", "pm").defaultOpenPanels).not.toContain("inspector");
  });
});
