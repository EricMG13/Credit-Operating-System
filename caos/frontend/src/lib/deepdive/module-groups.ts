import { MODULES, type ModuleDef } from "@/lib/pipeline/data";

export const DEEP_DIVE_MODULES: readonly ModuleDef[] = MODULES;

export const DEEP_DIVE_GROUP_LABELS = [
  "Foundation",
  "Analysis",
  "Governance & Debate",
] as const;

export type DeepDiveGroupLabel = (typeof DEEP_DIVE_GROUP_LABELS)[number];

export interface DeepDiveModuleGroup {
  label: DeepDiveGroupLabel;
  mods: readonly string[];
}

const GROUP_FOR_LAYER: Readonly<Record<string, DeepDiveGroupLabel>> = {
  L0: "Foundation",
  ORCH: "Foundation",
  L1: "Foundation",
  L2: "Analysis",
  L3: "Analysis",
  L4: "Analysis",
  L5: "Governance & Debate",
  L6: "Governance & Debate",
  INFRA: "Foundation",
};

export const DEEP_DIVE_MODULE_GROUPS: readonly DeepDiveModuleGroup[] =
  DEEP_DIVE_GROUP_LABELS.map((label) => ({
    label,
    mods: DEEP_DIVE_MODULES
      .filter((module) => GROUP_FOR_LAYER[module.layer] === label)
      .map((module) => module.id),
  }));

const GROUP_BY_MODULE = new Map(
  DEEP_DIVE_MODULE_GROUPS.flatMap((group) =>
    group.mods.map((moduleId) => [moduleId, group] as const),
  ),
);

export function deepDiveGroupForModule(moduleId: string): DeepDiveModuleGroup | undefined {
  return GROUP_BY_MODULE.get(moduleId);
}

export function deepDiveActiveGroup(moduleId: string): DeepDiveModuleGroup {
  return deepDiveGroupForModule(moduleId) ?? DEEP_DIVE_MODULE_GROUPS[0];
}

export function isDeepDiveGroupExpanded(group: DeepDiveModuleGroup, moduleId: string): boolean {
  return deepDiveActiveGroup(moduleId) === group;
}
