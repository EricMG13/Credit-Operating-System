// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { CitationViewer } from "./CitationViewer";
import { getChunk } from "@/lib/api";
import type { ChunkDTO } from "@/lib/query/types";

vi.mock("@/lib/api", () => ({ getChunk: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockGetChunk = vi.mocked(getChunk);

const CHUNK: ChunkDTO = {
  chunk_id: "abcdef1234567890",
  issuer_id: "iss-1",
  issuer_name: "Viasat Inc.",
  doc: "10-K FY2024",
  doc_type: "filing",
  seq: 7,
  text: "Total leverage stood at 5.4x at quarter end.",
};

describe("CitationViewer", () => {
  it("shows the loading state then the resolved chunk", async () => {
    mockGetChunk.mockResolvedValue(CHUNK);
    render(<CitationViewer chunkId="abcdef1234567890" onClose={() => {}} />);

    // Loading placeholder appears before the promise resolves.
    expect(screen.getByText("Loading source…")).toBeTruthy();

    // Resolved chunk renders issuer, doc_type, and text.
    expect(await screen.findByText("Viasat Inc.")).toBeTruthy();
    expect(screen.getByText("filing")).toBeTruthy();
    expect(
      screen.getByText("Total leverage stood at 5.4x at quarter end."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading source…")).toBeNull();
    expect(mockGetChunk).toHaveBeenCalledWith("abcdef1234567890");
  });

  it("renders the error detail when getChunk rejects", async () => {
    mockGetChunk.mockRejectedValue({
      response: { data: { detail: "chunk not found in index" } },
    });
    render(<CitationViewer chunkId="missing" onClose={() => {}} />);

    expect(await screen.findByText("chunk not found in index")).toBeTruthy();
    expect(screen.queryByText("Loading source…")).toBeNull();
  });

  it.each([
    [new Error("transport failed"), "transport failed"],
    [{}, "could not load source"],
  ])("falls back through the supported error shapes", async (reason, expected) => {
    mockGetChunk.mockRejectedValue(reason);
    render(<CitationViewer chunkId="missing" label="E-17" onClose={() => {}} />);

    expect(await screen.findByText(expected)).toBeTruthy();
    expect(screen.getByText("E-17")).toBeTruthy();
  });

  it("calls onClose on backdrop click", async () => {
    mockGetChunk.mockResolvedValue(CHUNK);
    const onClose = vi.fn();
    const { container } = render(
      <CitationViewer chunkId="abcdef1234567890" onClose={onClose} />,
    );
    // Let the async effect settle so we don't assert mid-update.
    await screen.findByText("Viasat Inc.");

    // The backdrop is the outermost fixed-inset element; the panel stops
    // propagation, so a click on the panel must NOT close.
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", async () => {
    mockGetChunk.mockResolvedValue(CHUNK);
    const onClose = vi.fn();
    render(<CitationViewer chunkId="abcdef1234567890" onClose={onClose} />);
    await waitFor(() => expect(mockGetChunk).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Close source viewer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
