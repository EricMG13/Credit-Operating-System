import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const seamFiles = [
  "src/components/upload/steps.tsx",
  "src/app/model/page.tsx",
  "src/app/model/ModelV2Workbench.tsx",
  "src/app/reports/page.tsx",
  "src/app/pipeline/page.tsx",
];

describe("completion presentation adoption", () => {
  it.each(seamFiles)("uses the shared four-axis contract at %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).toContain("CompletionStateSummary");
  });
});
