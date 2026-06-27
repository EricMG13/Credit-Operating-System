// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ getChunk: vi.fn() }));

import { getChunk } from "@/lib/api";
import { CitationViewer } from "./CitationViewer";
import type { ChunkDTO } from "@/lib/query/types";

const chunk: ChunkDTO = {
  chunk_id: "abcdef123456", issuer_id: "i1", issuer_name: "Carnival",
  doc: "Credit Agreement", doc_type: "EDGAR Exhibit", seq: 3,
  text: "Consolidated Net Leverage Ratio shall not exceed 6.50x.",
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CitationViewer", () => {
  it("is a labelled modal dialog and shows the loading state first", () => {
    vi.mocked(getChunk).mockReturnValue(new Promise(() => {})); // never resolves
    render(<CitationViewer chunkId="abcdef123456" label="E-CS1" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("E-CS1")).toBeTruthy();
    expect(screen.getByText("Loading source…")).toBeTruthy();
  });

  it("fetches the chunk and renders its source text + provenance", async () => {
    vi.mocked(getChunk).mockResolvedValue(chunk);
    render(<CitationViewer chunkId="abcdef123456" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(chunk.text)).toBeTruthy());
    expect(getChunk).toHaveBeenCalledWith("abcdef123456");
    expect(screen.getByText("Carnival")).toBeTruthy();
    expect(screen.getByText(/chunk abcdef12/)).toBeTruthy(); // 8-char id slice
  });

  it("surfaces a fetch error instead of the chunk", async () => {
    vi.mocked(getChunk).mockRejectedValue(new Error("could not load source"));
    render(<CitationViewer chunkId="x" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/could not load source/)).toBeTruthy());
  });

  it("closes on Escape and on backdrop click", async () => {
    vi.mocked(getChunk).mockResolvedValue(chunk);
    const onClose = vi.fn();
    render(<CitationViewer chunkId="abcdef123456" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("dialog").parentElement!); // backdrop
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
