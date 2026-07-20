import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/pipeline/data";
import {
  DEEP_DIVE_MODULE_GROUPS,
  DEEP_DIVE_MODULES,
  deepDiveGroupForModule,
  isDeepDiveGroupExpanded,
} from "./module-groups";

describe("Deep-Dive module partition", () => {
  it("is a total, disjoint partition of the finder catalog", () => {
    const finderIds = DEEP_DIVE_MODULES.map((module) => module.id);
    const groupedIds = DEEP_DIVE_MODULE_GROUPS.flatMap((group) => group.mods);

    expect(new Set(finderIds)).toEqual(new Set(MODULES.map((module) => module.id)));
    expect(new Set(groupedIds)).toEqual(new Set(finderIds));
    expect(groupedIds).toHaveLength(finderIds.length);
    expect(new Set(groupedIds).size).toBe(groupedIds.length);
  });

  it("maps every finder result to its sole expanded containing group", () => {
    for (const moduleDef of DEEP_DIVE_MODULES) {
      const containing = deepDiveGroupForModule(moduleDef.id);
      expect(containing?.mods).toContain(moduleDef.id);

      const expanded = DEEP_DIVE_MODULE_GROUPS.filter((group) =>
        isDeepDiveGroupExpanded(group, moduleDef.id),
      );
      expect(expanded).toHaveLength(1);
      expect(expanded[0]).toBe(containing);
      expect(expanded[0].mods).toContain(moduleDef.id);
    }
  });

  it("assigns the previously omitted analysis and infrastructure modules", () => {
    expect(deepDiveGroupForModule("CP-4C")?.label).toBe("Analysis");
    for (const id of ["CP-RENDER", "CP-EXTRACT", "CP-DB"]) {
      expect(deepDiveGroupForModule(id)?.label).toBe("Foundation");
    }
  });
});
