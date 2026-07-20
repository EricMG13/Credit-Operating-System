export const FRONTEND_PRODUCTION_ROOTS = ["src/app", "src/components", "src/lib"] as const;

export const COLOR_LITERAL_ALLOWLIST = {
  tokenDefinitions: [
    "src/app/globals.css",
    "src/lib/color-tokens.ts",
  ],
  charts: [
    "src/lib/chart-colors.ts",
    "src/lib/reports/builders.ts",
    "src/lib/command/rvdata.ts",
    "src/components/charts/G2Chart.tsx",
    "src/components/model/cell-style.ts",
    "src/components/query/node-style.ts",
    "src/components/query/GraphCanvas.tsx",
    "src/components/query/ScatterCanvas.tsx",
    "src/app/issuers/profile/ProfileContent.tsx",
  ],
} as const;

export interface ColorLiteralFinding {
  file: string;
  line: number;
  literal: string;
}

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, " "));
}

function stripRootTokenBlock(source: string) {
  const rootStart = source.indexOf(":root");
  const open = source.indexOf("{", rootStart);
  if (rootStart < 0 || open < 0) return source;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      const tokenBlock = source.slice(rootStart, index + 1).replace(/[^\n]/g, " ");
      return source.slice(0, rootStart) + tokenBlock + source.slice(index + 1);
    }
  }
  return source;
}

export function scanProductionColorLiterals(file: string, source: string): ColorLiteralFinding[] {
  if (COLOR_LITERAL_ALLOWLIST.charts.includes(file as (typeof COLOR_LITERAL_ALLOWLIST.charts)[number])) return [];
  if (file === "src/lib/color-tokens.ts") return [];

  let scannable = stripComments(source).replace(/\b(?:RUN|run)\s+#\d+\b/g, "");
  if (file === "src/app/globals.css") scannable = stripRootTokenBlock(scannable);

  return Array.from(scannable.matchAll(COLOR_LITERAL))
    .filter((match) => {
      if (!/^#\d{4}$/.test(match[0])) return true;
      const prefix = scannable.slice(Math.max(0, (match.index ?? 0) - 48), match.index);
      return !(/\brun\s*\($/i.test(prefix) || /label=["']Run["']\s+value=["']$/.test(prefix));
    })
    .map((match) => ({
      file,
      line: scannable.slice(0, match.index).split("\n").length,
      literal: match[0],
    }));
}
