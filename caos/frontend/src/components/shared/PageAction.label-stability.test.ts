import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const unstableDescriptorPatterns = [
  ["model-checkpoint", "src/app/model/page.tsx", 'label: state.saving || state.checkpointing ?'],
  ["model-save-suggestion", "src/app/model/ModelV2Workbench.tsx", 'label: state.busy === "save-suggestion" ?'],
  ["model-recalculate", "src/app/model/ModelV2Workbench.tsx", 'label: busy === "recalculate" ?'],
  ["model-commit", "src/app/model/ModelV2Workbench.tsx", 'label: busy === "commit" ?'],
  ["sector-refresh", "src/components/sector/SectorReviewDossier.tsx", "label: controller.busy ?"],
  ["query-run", "src/components/query/QueryInvestigationWorkbench.tsx", "label: state.execution.running ?"],
  ["research-run", "src/app/research/page.tsx", "const runLabel = running"],
  ["rv-run", "src/components/rv/RVScreenerWorkbench.tsx", 'if (controller.busy) return "Running…";'],
  ["report-publish", "src/app/reports/page.tsx", 'label: publishState === "publishing"'],
  ["thesis-affirm", "src/app/deepdive/page.tsx", 'label: affirmState === "saving"'],
] as const;

describe("PageAction label stability", () => {
  it.each(unstableDescriptorPatterns)("keeps progress out of the %s accessible label", (_descriptor, file, pattern) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).not.toContain(pattern);
  });
});
