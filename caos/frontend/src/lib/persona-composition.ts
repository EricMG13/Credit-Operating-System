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
  readonly emphasizedSlot: WorkbenchSlot;
  readonly leadingDataset?: string;
  readonly summaryLimit: number | null;
  readonly actionPriority?: readonly string[];
}

type SurfaceRoleConfiguration = {
  leadingDataset?: string;
  tableColumnPreset?: string;
} & Partial<Pick<SurfaceComposition, "slotOrder" | "defaultOpenPanels" | "actionPriority" | "summaryLimit">>;

const ANALYST_SLOT_ORDER: readonly WorkbenchSlot[] = ["decision", "primary", "context", "inspector", "utility", "finalization"];
const PM_SLOT_ORDER: readonly WorkbenchSlot[] = ["decision", "primary", "inspector", "context", "utility", "finalization"];
const QA_SLOT_ORDER: readonly WorkbenchSlot[] = ["inspector", "decision", "primary", "context", "utility", "finalization"];

function defineSurfaceCompositions(
  surface: AnalysisSurfaceName,
  dominantRepresentation: DominantRepresentation,
  configuration: Record<RoleView, SurfaceRoleConfiguration>,
): Record<RoleView, SurfaceComposition> {
  return {
    analyst: Object.freeze({
      surface,
      persona: "analyst",
      dominantRepresentation,
      slotOrder: configuration.analyst.slotOrder ?? ANALYST_SLOT_ORDER,
      defaultOpenPanels: configuration.analyst.defaultOpenPanels ?? ["primary", "context", "inspector"],
      summaryDensity: "detailed",
      emphasizedSlot: "primary",
      summaryLimit: configuration.analyst.summaryLimit ?? null,
      actionPriority: configuration.analyst.actionPriority,
      leadingDataset: configuration.analyst.leadingDataset,
      tableColumnPreset: configuration.analyst.tableColumnPreset,
    }),
    pm: Object.freeze({
      surface,
      persona: "pm",
      dominantRepresentation,
      slotOrder: configuration.pm.slotOrder ?? PM_SLOT_ORDER,
      defaultOpenPanels: configuration.pm.defaultOpenPanels ?? ["decision", "primary"],
      summaryDensity: "compact",
      emphasizedSlot: "decision",
      summaryLimit: configuration.pm.summaryLimit ?? null,
      actionPriority: configuration.pm.actionPriority,
      leadingDataset: configuration.pm.leadingDataset,
      tableColumnPreset: configuration.pm.tableColumnPreset,
    }),
    qa: Object.freeze({
      surface,
      persona: "qa",
      dominantRepresentation,
      slotOrder: configuration.qa.slotOrder ?? QA_SLOT_ORDER,
      defaultOpenPanels: configuration.qa.defaultOpenPanels ?? ["inspector", "primary", "decision"],
      summaryDensity: "standard",
      emphasizedSlot: "inspector",
      summaryLimit: configuration.qa.summaryLimit ?? null,
      actionPriority: configuration.qa.actionPriority,
      leadingDataset: configuration.qa.leadingDataset,
      tableColumnPreset: configuration.qa.tableColumnPreset,
    }),
  };
}

export const PERSONA_COMPOSITIONS: Record<AnalysisSurfaceName, Record<RoleView, SurfaceComposition>> = {
  issuers: defineSurfaceCompositions("issuers", "table", {
    analyst: {}, pm: {}, qa: {},
  }),
  upload: defineSurfaceCompositions("upload", "canvas", {
    analyst: {}, pm: {}, qa: {},
  }),
  research: defineSurfaceCompositions("research", "document", {
    analyst: {}, pm: {}, qa: {},
  }),
  sponsors: defineSurfaceCompositions("sponsors", "table", {
    analyst: {}, pm: {}, qa: {},
  }),
  command: defineSurfaceCompositions("command", "table", {
    analyst: { leadingDataset: "coverage" }, pm: { leadingDataset: "changes", tableColumnPreset: "pm-delta", summaryLimit: 4 }, qa: { leadingDataset: "governance" },
  }),
  "deep-dive": defineSurfaceCompositions("deep-dive", "document", {
    analyst: {}, pm: {}, qa: {},
  }),
  model: defineSurfaceCompositions("model", "model", {
    analyst: {}, pm: {}, qa: {},
  }),
  reports: defineSurfaceCompositions("reports", "document", {
    analyst: {}, pm: {}, qa: {},
  }),
  pipeline: defineSurfaceCompositions("pipeline", "graph", {
    analyst: {}, pm: {}, qa: {},
  }),
  monitor: defineSurfaceCompositions("monitor", "table", {
    analyst: { leadingDataset: "alerts" }, pm: { leadingDataset: "alerts" }, qa: { leadingDataset: "governance", tableColumnPreset: "qa-gates" },
  }),
  settings: defineSurfaceCompositions("settings", "canvas", {
    analyst: {}, pm: {}, qa: {},
  }),
  "issuer-profile": defineSurfaceCompositions("issuer-profile", "document", {
    analyst: {}, pm: {}, qa: {},
  }),
  "global-ask": defineSurfaceCompositions("global-ask", "canvas", {
    analyst: {}, pm: {}, qa: {},
  }),
  query: defineSurfaceCompositions("query", "graph", {
    analyst: {}, pm: {}, qa: {},
  }),
  "sector-review": defineSurfaceCompositions("sector-review", "document", {
    analyst: {}, pm: {}, qa: {},
  }),
  "rv-screener": defineSurfaceCompositions("rv-screener", "table", {
    analyst: {}, pm: {}, qa: {},
  }),
  "portfolio-lab": defineSurfaceCompositions("portfolio-lab", "table", {
    analyst: {}, pm: {}, qa: {},
  }),
  "ic-book": defineSurfaceCompositions("ic-book", "table", {
    analyst: {}, pm: {}, qa: {},
  }),
};

export function getSurfaceComposition(
  surface: AnalysisSurfaceName,
  persona: RoleView,
): SurfaceComposition {
  return PERSONA_COMPOSITIONS[surface][persona];
}
