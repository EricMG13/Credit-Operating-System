import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COLOR_LITERAL_ALLOWLIST,
  FRONTEND_PRODUCTION_ROOTS,
  scanProductionColorLiterals,
} from "./color-literal-policy";

const root = process.cwd();

function productionFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(absolute);
    if (!/\.(?:css|ts|tsx)$/.test(entry.name) || /\.(?:test|spec)\.[^.]+$/.test(entry.name)) return [];
    return [path.relative(root, absolute)];
  });
}

describe("frontend production color-literal policy", () => {
  it("uses the exact chart allowlist while rejecting a literal elsewhere", () => {
    const allowedPath = COLOR_LITERAL_ALLOWLIST.charts[0];
    expect(scanProductionColorLiterals(allowedPath, 'export const fill = "#123456";')).toEqual([]);
    expect(scanProductionColorLiterals("src/components/shared/BadSurface.tsx", 'export const fill = "#123456";')).toEqual([
      expect.objectContaining({ literal: "#123456" }),
    ]);
    expect(scanProductionColorLiterals("src/components/shared/BadSurface.tsx", 'export const fill = "#1234";')).toEqual([
      expect.objectContaining({ literal: "#1234" }),
    ]);
  });

  it("allows root token definitions but rejects a literal outside the root block", () => {
    const cssPath = COLOR_LITERAL_ALLOWLIST.tokenDefinitions[0];
    expect(scanProductionColorLiterals(cssPath, ":root { --ink: #16161e; }\n.panel { color: #16161e; }")).toEqual([
      expect.objectContaining({ literal: "#16161e" }),
    ]);
  });

  it("contains no non-allowlisted literals in the production frontend scope", () => {
    const files = FRONTEND_PRODUCTION_ROOTS.flatMap((directory) => productionFiles(path.join(root, directory)));
    const findings = files.flatMap((file) => scanProductionColorLiterals(file, fs.readFileSync(path.join(root, file), "utf8")));
    expect(findings).toEqual([]);
  });
});
