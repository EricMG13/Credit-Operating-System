import type { AnalysisSurfaceName } from "@/lib/analysis-workbench";
import type { RoleView } from "@/lib/api";

export const PERSONAS = ["analyst", "pm", "qa"] as const satisfies readonly RoleView[];
export type PersonaLens = RoleView;

export const ALL_ANALYSIS_SURFACES = [
  "issuers",
  "upload",
  "research",
  "sponsors",
  "command",
  "deep-dive",
  "model",
  "reports",
  "pipeline",
  "monitor",
  "settings",
  "issuer-profile",
  "global-ask",
  "query",
  "sector-review",
  "rv-screener",
  "portfolio-lab",
  "ic-book",
] as const satisfies readonly AnalysisSurfaceName[];

export type WorkbenchSlot =
  | "decision"
  | "primary"
  | "context"
  | "inspector"
  | "utility"
  | "finalization";

export type DominantRepresentation = "table" | "document" | "model" | "graph" | "canvas";

export type SummaryDensity = "compact" | "standard" | "detailed";

export interface SurfaceComposition {
  readonly surface: AnalysisSurfaceName;
  readonly persona: RoleView;
  readonly slotOrder: readonly WorkbenchSlot[];
  readonly dominantRepresentation: DominantRepresentation;
  readonly defaultOpenPanels: readonly string[];
  readonly tableColumnPreset?: string;
  readonly summaryDensity: SummaryDensity;
}

interface SurfaceProfile {
  dominantRepresentation: DominantRepresentation;
  tableColumnPreset?: string;
}

const SURFACE_PROFILES: Record<AnalysisSurfaceName, SurfaceProfile> = {
  issuers: { dominantRepresentation: "table", tableColumnPreset: "coverage" },
  upload: { dominantRepresentation: "canvas" },
  research: { dominantRepresentation: "document" },
  sponsors: { dominantRepresentation: "table", tableColumnPreset: "sponsor-risk" },
  command: { dominantRepresentation: "table", tableColumnPreset: "ranked-changes" },
  "deep-dive": { dominantRepresentation: "document" },
  model: { dominantRepresentation: "model" },
  reports: { dominantRepresentation: "document" },
  pipeline: { dominantRepresentation: "graph", tableColumnPreset: "pipeline-queue" },
  monitor: { dominantRepresentation: "table", tableColumnPreset: "alerts" },
  settings: { dominantRepresentation: "canvas" },
  "issuer-profile": { dominantRepresentation: "document" },
  "global-ask": { dominantRepresentation: "canvas" },
  query: { dominantRepresentation: "graph" },
  "sector-review": { dominantRepresentation: "document", tableColumnPreset: "sector-risk" },
  "rv-screener": { dominantRepresentation: "table", tableColumnPreset: "relative-value" },
  "portfolio-lab": { dominantRepresentation: "table", tableColumnPreset: "positions" },
  "ic-book": { dominantRepresentation: "table", tableColumnPreset: "decisions" },
};

const PERSONA_LAYOUTS: Record<
  RoleView,
  Pick<SurfaceComposition, "slotOrder" | "defaultOpenPanels" | "summaryDensity">
> = {
  analyst: {
    slotOrder: ["decision", "primary", "context", "inspector", "utility", "finalization"],
    defaultOpenPanels: ["primary", "context", "inspector"],
    summaryDensity: "detailed",
  },
  pm: {
    slotOrder: ["decision", "primary", "inspector", "context", "utility", "finalization"],
    defaultOpenPanels: ["decision", "primary"],
    summaryDensity: "compact",
  },
  qa: {
    slotOrder: ["decision", "primary", "inspector", "context", "utility", "finalization"],
    defaultOpenPanels: ["decision", "inspector", "primary"],
    summaryDensity: "standard",
  },
};

export const PERSONA_COMPOSITIONS = Object.fromEntries(
  ALL_ANALYSIS_SURFACES.map((surface) => [
    surface,
    Object.fromEntries(PERSONAS.map((persona) => [
      persona,
      Object.freeze({
        surface,
        persona,
        ...PERSONA_LAYOUTS[persona],
        ...SURFACE_PROFILES[surface],
      }),
    ])) as Record<RoleView, SurfaceComposition>,
  ]),
) as Record<AnalysisSurfaceName, Record<RoleView, SurfaceComposition>>;

export function getSurfaceComposition(
  surface: AnalysisSurfaceName,
  persona: RoleView,
): SurfaceComposition {
  return PERSONA_COMPOSITIONS[surface][persona];
}
