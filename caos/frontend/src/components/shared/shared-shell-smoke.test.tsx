// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/deepdive/name" } }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next/link", () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: { children: React.ReactNode; href: string; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("./RoleViewSwitch", () => ({ RoleViewSwitch: () => <span>role switch</span> }));
vi.mock("./AnalystBadge", () => ({ AnalystBadge: () => <span>analyst badge</span> }));

import { EvidenceInspector } from "./EvidenceInspector";
import { WorkflowRail } from "./WorkflowRail";

afterEach(cleanup);

describe("shared workspace shell", () => {
  it("renders the workflow registry and marks nested and settings routes active", () => {
    const { rerender } = render(<WorkflowRail />);
    const rail = screen.getByRole("complementary", { name: "Workspace navigation" });
    expect(within(rail).getByRole("link", { name: "Deep-Dive" }).getAttribute("aria-current")).toBe("page");
    expect(within(rail).getByText("role switch")).toBeTruthy();
    pathname.value = "/settings/access";
    rerender(<WorkflowRail />);
    expect(within(rail).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
  });

  it("renders populated and empty evidence states", () => {
    const provenance = { origin: "LIVE" as const, method: "DERIVED" as const, freshness: "STALE" as const, detail: "Ledger" };
    const { rerender } = render(
      <EvidenceInspector
        title="Claim register"
        provenance={provenance}
        approval="RATIFIED"
        asOf="17 Jul 2026"
        claims={[
          { id: "C1", text: "Leverage increased", source: "10-Q", state: "current" },
          { id: "C2", text: "Liquidity tightened" },
        ]}
        consumers={["Model", "Report"]}
        glossary={[{ term: "RCF", definition: "Revolving credit facility" }]}
        className="custom-inspector"
      />,
    );
    expect(screen.getByRole("complementary", { name: "Claim register" }).className).toContain("custom-inspector");
    expect(screen.getByText("10-Q · current")).toBeTruthy();
    expect(screen.getByText("Source unavailable")).toBeTruthy();
    expect(screen.getByText("Model · Report")).toBeTruthy();
    expect(screen.getByText("Revolving credit facility")).toBeTruthy();

    rerender(<EvidenceInspector provenance={provenance} asOf="now" />);
    expect(screen.getByText("No claim selected.")).toBeTruthy();
    expect(screen.queryByText("Downstream consumers")).toBeNull();
  });
});
