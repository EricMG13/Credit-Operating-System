// @vitest-environment jsdom
//
// Regression for matrix 4.2 (second layer): EvidenceModal must not
// shadow-resolve a live run's E-xx id to the seeded ATLF excerpt and present
// it as VERIFIED for another issuer. With isLiveRun, a missing id renders the
// explicit unresolved panel instead.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceModal } from "./EvidenceModal";
import { EVIDENCE } from "@/lib/reports/evidence";

const anySeededId = Object.keys(EVIDENCE)[0];

describe("EvidenceModal shadow-resolve guard (matrix 4.2)", () => {
  it("isLiveRun: a seeded id renders the unresolved panel, not the ATLF excerpt", () => {
    render(<EvidenceModal id={anySeededId} reports={[]} isLiveRun onClose={vi.fn()} />);
    // Unresolved panel showing IS the guard — the seeded excerpt never renders.
    expect(screen.getByText(/unresolved/i)).toBeTruthy();
  });

  it("reference (default): the same id resolves to the seeded excerpt", () => {
    render(<EvidenceModal id={anySeededId} reports={[]} onClose={vi.fn()} />);
    expect(screen.queryByText(/lineage is unresolved/i)).toBeNull();
  });
});
