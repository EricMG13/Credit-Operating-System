// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnterprisePage } from "./EnterprisePage";

vi.mock("./ResponsiveShell", () => ({
  ResponsiveShell: ({ children, className, heightClass }: {
    children: React.ReactNode; className: string; heightClass: string;
  }) => <main data-class={className} data-height={heightClass}>{children}</main>,
}));
vi.mock("./AnalysisContextStrip", () => ({ AnalysisContextStrip: () => <div>context strip</div> }));

afterEach(cleanup);

describe("EnterprisePage", () => {
  it("renders decision and finalization anatomy with custom shell classes", () => {
    render(
      <EnterprisePage
        kind="editor"
        identity={<span>identity</span>}
        decisionContext={<div>decision context</div>}
        finalizationBar={<button type="button">Finalize</button>}
        narrowContract={{ essentialControls: null }}
        className="custom"
        heightClass="min-h-screen"
      >
        <div>body</div>
      </EnterprisePage>,
    );

    expect(screen.getByText("context strip")).toBeTruthy();
    expect(screen.getByText("decision context")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
    expect(screen.getByRole("contentinfo", { name: "Page finalization actions" })).toBeTruthy();
    expect(screen.getByRole("main").getAttribute("data-class")).toContain("custom");
    expect(screen.getByRole("main").getAttribute("data-height")).toBe("min-h-screen");
  });
});
