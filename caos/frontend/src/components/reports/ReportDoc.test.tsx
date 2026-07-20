// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReports, type Report } from "@/lib/reports/builders";
import { ReportDoc } from "./ReportDoc";

vi.mock("./AuthorityBlock", () => ({
  ReportAuthority: ({ runId }: { runId?: string | null }) => <div data-testid="authority-block">Authority {runId ?? "none"}</div>,
}));

afterEach(cleanup);

const report = (overrides: Partial<Report> = {}): Report => ({
  id: "memo",
  title: "Credit memo",
  subtitle: "Committee draft",
  file: "credit-memo",
  icon: "memo",
  srcs: [],
  sections: [],
  ...overrides,
});

describe("ReportDoc period groups", () => {
  it("renders stable group-start metadata on appendix headers and body cells", () => {
    const appendix = buildReports().find((report) => report.id === "model");
    if (!appendix) throw new Error("model appendix fixture is required");

    const { container } = render(<ReportDoc rep={appendix} showSources edits={{ title: "Edited model appendix" }} />);
    const keys = ["Q", "YTD", "HIST", "LTM", "PF", "BASE", "DOWN"];
    for (const key of keys) {
      expect(container.querySelector(`th.rd-group-start[data-column-group="${key}"]`)).toBeTruthy();
      expect(container.querySelector(`td.rd-group-start[data-column-group="${key}"]`)).toBeTruthy();
    }
    expect(screen.getByText(/CAOS · MODEL APPENDIX · REFERENCE FIXTURE/)).toBeTruthy();
    expect(screen.getByText(/REFERENCE · NOT A LIVE ISSUER RUN/)).toBeTruthy();
    expect(screen.getByText("1 analyst override applied")).toBeTruthy();
    expect(container.querySelector(".rd-sources")).toBeNull();
    expect(container.querySelector(".rd-foot")).toBeNull();
  });

  it("marks the model appendix as a live issuer run instead of the fixture disclaimer when it is one", () => {
    // The appendix used to print "RUN #2641 · … · NOT A LIVE ISSUER RUN"
    // unconditionally — including for an appendix actually built from a live
    // run's numbers, which is exactly backwards.
    render(
      <ReportDoc
        rep={report({ id: "model" })}
        authority={{ caveatKind: "live", liveRunBacked: true, runId: "live-run-9" }}
      />,
    );
    expect(screen.getByText(/RUN LIVE-RUN · LIVE ISSUER RUN/)).toBeTruthy();
    expect(screen.queryByText(/NOT A LIVE ISSUER RUN/)).toBeNull();
    expect(screen.queryByText(/RUN #2641/)).toBeNull();
  });

  it("renders every section kind and supports bounded edits, safe paste, revert, evidence, and add-back suppression", () => {
    const onEdit = vi.fn();
    const onOpenEvidence = vi.fn();

    const rich = report({
      watermark: "DRAFT",
      srcs: [
        { chip: "MKT", ev: ["E-1"] },
        { chip: "M-118", ev: [] },
        { chip: "UNKNOWN", ev: ["E-2"] },
      ],
      sections: [
        {
          t: "table", title: "Adjustments", sub: "$M", cols: ["Line", "Value"], align: [0, 1],
          columnGroups: [{ start: 1, key: "LTM", label: "Last twelve months" }],
          rows: [
            { cells: ["Restructuring", "12"], b: 1 },
            { cells: ["Revenue", "100"], b: 1, it: 1, line: 1, gap: 1, cellColors: [undefined, "#123456"] },
            { cells: ["", null as unknown as string], lbl0: "%Δ" },
          ],
          note: "Adjustment note",
        },
        { t: "profile", title: "Profile", rows: [["Sector", "Industrials"], ["Rating", "B"]], boldLast: 1 },
        { t: "text", title: "Thesis", subhead: "Base case", body: "Stable cash flow", label: "Risk", labelBody: "Cyclicality" },
        { t: "list", title: "Catalysts", subhead: "Near term", items: ["Deleveraging", "Refinancing"] },
        {
          t: "chart", title: "Leverage", h: 0, kind: "line", unit: "x", sourceIds: ["E-1"],
          accessibleSummary: "Leverage declines.", columns: [{ key: "period", label: "Period" }],
          spec: { type: "line", data: [{ period: "FY26", value: 4.2 }], encode: { x: "period", y: "value" } },
          note: "Chart note",
        },
        {
          t: "cols", w: [2], items: [
            [{ t: "list", items: ["Untitled item"] }],
            [{ t: "table", title: "Compact", cols: ["A"], align: undefined as unknown as number[], rows: [{ cells: ["1"] }] }],
          ],
        },
        { t: "unsupported" } as never,
      ],
    });

    const { container } = render(
      <ReportDoc
        rep={rich}
        paper="#ffffff"
        showSources
        edits={{ title: "Analyst title", "s0.title": "Adjusted EBITDA", "s1.r0.l": "Hidden edit", metadata: "kept" }}
        onEdit={onEdit}
        editableSectionCount={1}
        hideAddbacks
        onOpenEvidence={onOpenEvidence}
        authority={{ caveatKind: "live", liveRunBacked: true, runId: "run-live" }}
      />,
    );

    expect(container.querySelector(".rd-paper")?.getAttribute("style")).toContain("rgb(255, 255, 255)");
    expect(container.querySelectorAll(".rd-wm span")).toHaveLength(3);
    expect(screen.getByTestId("authority-block").textContent).toContain("run-live");
    // The masthead identity must come from the real run, never a hardcoded
    // "RUN #2641" — every deliverable used to print the same fixture run/date
    // regardless of what actually backed it.
    expect(screen.getByText(/RUN RUN-LIVE · INTERNAL USE/)).toBeTruthy();
    expect(screen.queryByText(/RUN #2641/)).toBeNull();
    expect(screen.queryByText("Restructuring")).toBeNull();
    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("%Δ")).toBeTruthy();
    expect(container.querySelector("tr.rd-b.rd-it.rd-line.rd-gapr")).toBeTruthy();
    expect(container.querySelector('td[style*="color"]')).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("Stable cash flow")).toBeTruthy();
    expect(screen.getByText("Deleveraging")).toBeTruthy();
    expect(screen.getByTestId("report-visualization").getAttribute("data-height")).toBe("190");
    expect(screen.getByText("Untitled item")).toBeTruthy();
    expect(screen.getByText("Compact")).toBeTruthy();
    expect(screen.queryByText("Hidden edit")).toBeNull();
    expect(screen.getByText("3 analyst overrides applied · EBITDA add-back detail suppressed")).toBeTruthy();

    const title = screen.getByRole("textbox", { name: "Edit report field title" });
    expect(title.textContent).toBe("Analyst title");
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    expect(title.dispatchEvent(paste)).toBe(true);
    expect(paste.defaultPrevented).toBe(false);
    title.innerHTML = `<strong>${"x".repeat(2100)}</strong>`;
    fireEvent.input(title, { inputType: "insertFromPaste" });
    expect(title.querySelector("strong")).toBeNull();
    expect(title.textContent).toBe("x".repeat(2000));

    title.innerText = "Changed title";
    fireEvent.blur(title);
    expect(onEdit).toHaveBeenCalledWith("title", "Changed title");
    title.innerText = "scratch";
    fireEvent.keyDown(title, { key: "Escape" });
    expect(title.innerText).toBe("Analyst title");

    fireEvent.click(screen.getAllByRole("button", { name: "Revert override" })[0]);
    expect(onEdit).toHaveBeenCalledWith("title", undefined);

    fireEvent.click(screen.getByRole("button", { name: "Open source E-1" }));
    expect(onOpenEvidence).toHaveBeenCalledWith("E-1");
    expect(screen.getByText("Market data feed")).toBeTruthy();
    expect(screen.getByText("Cash-flow model M-118")).toBeTruthy();
    expect(screen.getByText("render input")).toBeTruthy();
    expect(screen.getByText("no registered evidence id")).toBeTruthy();
  });

  it("groups paged sections, omits requested content, prints citations, and shows the defensive authority note", () => {
    const paged = report({
      watermark: "IC",
      srcs: [{ chip: "MKT", ev: ["E-9"] }],
      sections: [
        { t: "text", page: "Summary", body: "Opening" },
        { t: "list", page: "Details", items: ["Detail"] },
        {
          t: "chart", page: "Details", title: "Unnoted chart", kind: "bar", sourceIds: [],
          accessibleSummary: "One bar.", columns: [{ key: "name", label: "Name" }],
          spec: { type: "interval", data: [{ name: "A", value: 1 }], encode: { x: "name", y: "value" } },
        },
        { t: "text", page: "Summary", body: "Grouped with summary" },
        { t: "profile", rows: [["Owner", "Credit"]] },
        { t: "text", page: "Hidden", body: "Omitted section" },
      ],
    });

    const { container, rerender } = render(
      <ReportDoc rep={paged} omit={{ 5: true }} showSources edits={{ title: "Paged title" }} onEdit={vi.fn()} />,
    );

    expect(container.querySelectorAll(".rd-page-container")).toHaveLength(3);
    expect(screen.getByText(/SUMMARY/)).toBeTruthy();
    expect(screen.getByText(/DETAILS/)).toBeTruthy();
    expect(screen.getByText(/PAGE GROUP/)).toBeTruthy();
    expect(screen.getByText(/PAGE 1 of 3/)).toBeTruthy();
    expect(screen.getAllByText("Paged title")).toHaveLength(1);
    expect(screen.getByText("Grouped with summary")).toBeTruthy();
    expect(screen.queryByText("Omitted section")).toBeNull();
    expect(screen.getByRole("note")).toBeTruthy();
    expect(container.querySelector("sup.rd-cite-print")?.textContent).toBe("E-9");
    expect(screen.getByText("1 analyst override applied")).toBeTruthy();

    rerender(
      <ReportDoc
        rep={{ ...paged, watermark: undefined }}
        omit={{ 5: true }}
        editableSectionCount={1}
        authority={{ caveatKind: "live", liveRunBacked: true, runId: "paged-live" }}
      />,
    );
    expect(container.querySelector(".rd-wm")).toBeNull();
    expect(screen.getByTestId("authority-block").textContent).toContain("paged-live");
    expect(screen.getByText(/RUN PAGED-LI · PAGE 1 of 3/)).toBeTruthy();
    expect(container.querySelector(".rd-sources")).toBeNull();
    expect(container.querySelector(".rd-colophon")).toBeNull();
  });

  it("renders the non-paged fallback authority disclaimer and default paper", () => {
    const { container } = render(<ReportDoc rep={report({ sections: [
      { t: "text", body: "Body" },
      { t: "table", cols: [""], align: [], rows: [{ cells: [""], lbl0: "Fallback label" }] },
    ] })} />);
    expect(screen.getByRole("note")).toBeTruthy();
    // No authority prop at all (the true reference/fixture case) — the
    // masthead must say so plainly instead of stamping a fake specific run.
    expect(screen.getByText(/REFERENCE · INTERNAL USE/)).toBeTruthy();
    expect(screen.getByText("Fallback label").classList.contains("rd-lbl0")).toBe(true);
    expect(container.querySelector(".rd-paper")?.getAttribute("style")).toContain("var(--paper-bg)");
    expect(screen.getByText(/Generated by CAOS · CP-RENDER · credit-memo.pdf/)).toBeTruthy();
  });
});
