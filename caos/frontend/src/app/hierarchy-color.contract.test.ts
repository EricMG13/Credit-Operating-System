import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const shellIdentity = fs.readFileSync(path.join(root, "src/components/shared/ShellIdentity.tsx"), "utf8");
const toolbar = fs.readFileSync(path.join(root, "src/components/shared/WorkbenchToolbar.tsx"), "utf8");
const panel = fs.readFileSync(path.join(root, "src/components/shared/Panel.tsx"), "utf8");
const portfolio = fs.readFileSync(path.join(root, "src/components/portfolio/PortfolioLabWorkbench.tsx"), "utf8");
const reportDoc = fs.readFileSync(path.join(root, "src/components/reports/ReportDoc.tsx"), "utf8");
const loginLanding = fs.readFileSync(path.join(root, "src/components/shared/LoginLanding.tsx"), "utf8");
const routeError = fs.readFileSync(path.join(root, "src/components/shared/RouteErrorBoundary.tsx"), "utf8");
const notFound = fs.readFileSync(path.join(root, "src/app/not-found.tsx"), "utf8");

function block(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
}

describe("shared semantic hierarchy and report proofing contracts", () => {
  it("uses the 16/14/13/12px semantic workspace tiers", () => {
    expect(shellIdentity).toContain("caos-shell-identity-title");
    expect(toolbar).toContain("caos-workbench-title");
    expect(panel).toContain("caos-panel-title");
    expect(block(".caos-shell-identity-title")).toContain("font-size: 1rem");
    expect(block(".caos-workbench-title")).toContain("font-size: 0.875rem");
    expect(block(".caos-panel-title")).toContain("font-size: 0.8125rem");
    expect(block("body")).toContain("font-size: 0.75rem");
  });

  it("enforces screen and print proofing floors without scaled-down report headings", () => {
    expect(block(".rd-body")).toContain("font-size: 12px");
    expect(block(".rd-table tbody :is(th, td)")).toContain("font-size: 11px");
    expect(block(".rd-model-appendix .rd-table tbody :is(th, td)")).toContain("font-size: 10px");
    expect(css).toContain(".print-root :is(.rd-body");
    expect(css).toContain("font-size: 9.5pt");
    expect(css).toContain("font-size: 8pt");
  });

  it("leaves the global route heading as the only route-level h1", () => {
    expect(portfolio).not.toMatch(/<h1[\s>]/);
    expect(reportDoc).not.toMatch(/<h1[\s>]/);
    expect(loginLanding).not.toMatch(/<h1[\s>]/);
    expect(routeError).not.toMatch(/<h1[\s>]/);
    expect(notFound).not.toMatch(/<h1[\s>]/);
  });
});

describe("shared/report CSS color governance", () => {
  it("keeps color literals in root token definitions rather than shared/report rules", () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rootEnd = withoutComments.indexOf("}\n\nbody");
    const nonTokenCss = withoutComments.slice(rootEnd + 1);
    expect(nonTokenCss.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) ?? []).toEqual([]);
    expect(block(".text-caos-critical")).toContain("var(--caos-critical-bright)");
  });
});
