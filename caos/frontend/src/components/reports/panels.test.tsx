// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { Report, Section } from "@/lib/reports/builders";
import { ComposePanel, ExportPanel, LineagePanel, ReportList } from "./panels";

vi.mock("./ExportToVaultButton", () => ({
  ExportToVaultButton: ({ runId }: { runId: string }) => <button type="button">vault {runId}</button>,
}));

afterEach(cleanup);

const plainSections: Section[] = [
  { t: "text", title: "Executive view", body: "Body" },
  { t: "list", subhead: "Key risks", items: ["Risk"] },
  { t: "profile", rows: [["Issuer", "ATLF"]] },
];

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: "memo",
    title: "Credit memo",
    file: "memo.pdf",
    subtitle: "Committee",
    icon: "gavel",
    srcs: [
      { chip: "CP-1", ev: ["E-1", "E-2"] },
      { chip: "MKT", ev: ["E-2"] },
      { chip: "M-118 detail", ev: ["E-3"] },
      { chip: "UNKNOWN", ev: [] },
    ],
    sections: plainSections,
    ...overrides,
  };
}

describe("report rail panels", () => {
  it("selects reports, collapses the rail, and renders ready/held metadata", () => {
    const onSel = vi.fn();
    const onCollapse = vi.fn();
    render(
      <ReportList
        reports={[
          report(),
          report({ id: "digest", title: "Digest", icon: "unknown", watermark: "conditional", sections: [plainSections[0]] }),
        ]}
        active="memo"
        onSel={onSel}
        onCollapse={onCollapse}
        isReference
      />,
    );
    expect(screen.getByRole("button", { name: /Credit memo/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("READY")).toBeTruthy();
    expect(screen.getByText("HELD")).toBeTruthy();
    expect(screen.getByText("3 sections · 3 citations")).toBeTruthy();
    expect(screen.getByText(/reference deliverables.*QA-117 open/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Digest/ }));
    expect(onSel).toHaveBeenCalledWith("digest");
    fireEvent.click(screen.getByRole("button", { name: "COLLAPSE" }));
    expect(onCollapse).toHaveBeenCalled();
  });

  it("renders report list without an optional collapse action", () => {
    render(<ReportList reports={[report()]} active="other" onSel={vi.fn()} isReference />);
    expect(screen.queryByRole("button", { name: "COLLAPSE" })).toBeNull();
    expect(screen.getByRole("button", { name: /Credit memo/ }).hasAttribute("aria-current")).toBe(false);
  });

  it("resolves lineage names and opens evidence", () => {
    const onOpen = vi.fn();
    render(<LineagePanel rep={report()} onOpenEvidence={onOpen} />);
    expect(screen.getByRole("option", { name: /E-2.*Market data feed/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /E-3.*Cash-flow model M-118/ })).toBeTruthy();
    expect(screen.getByText(/No registered evidence ID · UNKNOWN/)).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /E-1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Open source E-1 —/ }));
    expect(onOpen).toHaveBeenCalledWith("E-1");
  });

  it("toggles flat compose sections and handles a missing omit map", () => {
    const onToggle = vi.fn();
    render(<ComposePanel rep={report()} omit={null as never} onToggle={onToggle} />);
    expect(screen.getByText("3/3 sections")).toBeTruthy();
    expect(screen.getByTitle("Executive view")).toBeTruthy();
    expect(screen.getByTitle("Key risks")).toBeTruthy();
    expect(screen.getByTitle("PROFILE")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Key risks").closest("button")!);
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("groups paged compose sections and marks omitted entries", () => {
    const sections: Section[] = [
      { ...plainSections[0], page: "Overview" },
      { ...plainSections[1], page: "Overview" },
      { ...plainSections[2] },
    ];
    const onToggle = vi.fn();
    render(<ComposePanel rep={report({ sections })} omit={{ 1: true }} onToggle={onToggle} />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Page Group")).toBeTruthy();
    expect(screen.getByText("2/3 sections")).toBeTruthy();
    const risk = screen.getByTitle("Key risks");
    expect(risk.className).toContain("line-through");
    fireEvent.click(risk.closest("button")!);
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("renders clean and conditional export states, edits, and vault action", () => {
    const { rerender } = render(<ExportPanel rep={report()} omitCount={1} />);
    expect(screen.getByText("2 of 3 included")).toBeTruthy();
    expect(screen.getAllByText("none", { selector: "span.tabular" })).toHaveLength(2);
    // Must never claim a specific audit event ("CP-5 trace audit passed")
    // that no code path actually runs — only the real, computed fact.
    expect(screen.getByText(/No held watermark.*3 citations in the source register/)).toBeTruthy();
    expect(screen.queryByText(/trace audit passed/)).toBeNull();
    expect(screen.queryByText(/orphaned/)).toBeNull();
    expect(screen.queryByRole("button", { name: /vault/ })).toBeNull();

    rerender(<ExportPanel rep={report({ watermark: "conditional" })} omitCount={0} editCount={1} runId="run-7" />);
    expect(screen.getByText("1 override")).toBeTruthy();
    expect(screen.getByText("CONDITIONAL — QA-117")).toBeTruthy();
    expect(screen.getByRole("button", { name: "vault run-7" })).toBeTruthy();

    rerender(<ExportPanel rep={report()} omitCount={0} editCount={2} />);
    expect(screen.getByText("2 overrides")).toBeTruthy();
  });

  it("holds a live-backed report on its real committee status, not just rep.watermark", () => {
    // buildLiveReports never sets rep.watermark — this is the only signal a
    // Restricted/Blocked live run has, and it used to be ignored entirely.
    render(
      <ReportList
        reports={[report()]}
        active="memo"
        onSel={vi.fn()}
        isReference={false}
        liveHeldReason="COMMITTEE: Restricted"
      />,
    );
    expect(screen.getByText("HELD")).toBeTruthy();
    expect(screen.queryByText("READY")).toBeNull();
    expect(screen.getByText(/Live deliverables follow the active run/)).toBeTruthy();
    expect(screen.getByText("COMMITTEE: Restricted")).toBeTruthy();
    expect(screen.queryByText(/QA-117 open/)).toBeNull();
    cleanup();

    render(<ReportList reports={[report()]} active="memo" onSel={vi.fn()} isReference={false} />);
    expect(screen.getByText(/Review the server-frozen preview before publication/)).toBeTruthy();
    expect(screen.queryByText(/QA-117 open/)).toBeNull();
    cleanup();

    render(<ExportPanel rep={report()} omitCount={0} liveHeldReason="COMMITTEE: Restricted" />);
    expect(screen.getByText("COMMITTEE: Restricted")).toBeTruthy();
    expect(screen.getByText(/not reached Committee Ready/)).toBeTruthy();
    expect(screen.queryByText(/No held watermark/)).toBeNull();
  });
});
