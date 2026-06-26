// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  getChunk: vi.fn().mockResolvedValue({ text: "LIVE CHUNK TEXT", chunk_id: "chunk-1" }),
}));

import { EvidenceModal } from "./EvidenceModal";
import type { LiveEvidence } from "@/lib/engine/useLiveRun";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const liveEv = (over: Partial<LiveEvidence> = {}): LiveEvidence => ({
  evidence_id: "E-09", extraction_type: "table_value", lineage_class: "Directly Sourced",
  source_locator: "Issuer credit agreement §6.1", confidence: "High", document_chunk_id: "chunk-1",
  module: "CP-1", claim: "Live run claim — net leverage 4.8x.", ...over,
});

describe("EvidenceModal live resolution", () => {
  it("prefers the run's own evidence over a colliding seeded key, and fetches the real chunk", async () => {
    // E-09 also exists in the seeded EVIDENCE map (the $76.6M / 18.2% ATLF excerpt).
    render(<EvidenceModal id="E-09" reports={[]} live={{ "E-09": liveEv() }} onClose={() => {}} />);
    expect(screen.getByText("Live run claim — net leverage 4.8x.")).toBeTruthy();
    expect(screen.getByText("CP-1")).toBeTruthy();
    // The seeded source must NOT shadow the live claim.
    expect(screen.queryByText(/76\.6 million/)).toBeNull();
    // The live excerpt resolves from the run's own chunk.
    expect(await screen.findByText("LIVE CHUNK TEXT")).toBeTruthy();
  });

  it("shows an explicit unresolved state for an unknown id — never a silent no-op", () => {
    const { container } = render(<EvidenceModal id="E-NOPE" reports={[]} onClose={() => {}} />);
    expect(container.textContent).toContain("could not be resolved");
    expect(container.textContent).toContain("E-NOPE");
  });

  it("falls back to the seeded map for a seeded id with no live entry", () => {
    render(<EvidenceModal id="E-09" reports={[]} onClose={() => {}} />);
    expect(screen.getByText(/76\.6 million/)).toBeTruthy();
  });
});
