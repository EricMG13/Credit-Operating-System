// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SectorReviewV2 } from "@/lib/analysis-workbench";
import { SectorReviewContent } from "./SectorReviewPanels";

afterEach(cleanup);

function reviewFixture(): SectorReviewV2 {
  return {
    dimension_scores: [{ id: "quality", label: "Business quality", score: 72, confidence: 0.84 }],
    sections: [{ id: "thesis", title: "Sector thesis", summary: "Pricing remains rational.", freshness: "current" }],
    ratifications: {},
  } as unknown as SectorReviewV2;
}

describe("SectorReviewContent", () => {
  it("renders the honest empty state when no versioned review exists", () => {
    render(<SectorReviewContent review={null} tab="overview" selectedSection={null} onSelectSection={() => {}} />);

    expect(screen.getByText(/No versioned dossier exists/)).toBeTruthy();
  });

  it("renders overview evidence and delegates section selection", () => {
    const onSelectSection = vi.fn();
    render(
      <SectorReviewContent
        review={reviewFixture()}
        tab="overview"
        selectedSection={null}
        onSelectSection={onSelectSection}
      />,
    );

    expect(screen.getByText("Business quality")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sector thesis/ }));
    expect(onSelectSection).toHaveBeenCalledWith("thesis");
  });
});
