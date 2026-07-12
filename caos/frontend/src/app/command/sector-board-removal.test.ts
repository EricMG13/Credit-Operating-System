import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");

describe("Command Sector Board removal", () => {
  it("does not retain SectorBoard state, rendering, or sector filtering", () => {
    expect(source).not.toContain("SectorBoard");
    expect(source).not.toContain("boardCollapsed");
    expect(source).not.toContain("boardSummary");
    expect(source).not.toContain("sectorFilter");
  });
});
