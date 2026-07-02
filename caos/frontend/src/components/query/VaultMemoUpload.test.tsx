// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ uploadVaultMemo: vi.fn() }));

import { VaultMemoUpload } from "./VaultMemoUpload";
import { uploadVaultMemo } from "@/lib/api";

const mockUpload = vi.mocked(uploadVaultMemo);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function openDialogWithFile() {
  render(<VaultMemoUpload onUploaded={onUploaded} />);
  fireEvent.click(screen.getByRole("button", { name: "ADD MEMO" }));
  const input = screen.getByLabelText("Memo file (.md, .txt or .pdf)");
  fireEvent.change(input, {
    target: { files: [new File(["Acme Corp looks rich."], "Weekly Wrap.md", { type: "text/markdown" })] },
  });
}

const onUploaded = vi.fn();

describe("VaultMemoUpload", () => {
  it("posts the file + memo type and reports issuer links", async () => {
    mockUpload.mockResolvedValue({
      note: "Weekly Wrap",
      path: "Analyst-Memos/Weekly Wrap.md",
      memo_type: "market-commentary",
      issuer_links: ["Acme Corp"],
      message: "ok",
    });
    openDialogWithFile();
    fireEvent.click(screen.getByRole("button", { name: "UPLOAD" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    const fd = mockUpload.mock.calls[0][0] as FormData;
    expect(fd.get("memo_type")).toBe("market-commentary");
    expect((fd.get("file") as File).name).toBe("Weekly Wrap.md");
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    // dialog closes on success
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("surfaces the server detail on failure and stays open", async () => {
    mockUpload.mockRejectedValue({ response: { data: { detail: "No vault configured" } } });
    openDialogWithFile();
    fireEvent.click(screen.getByRole("button", { name: "UPLOAD" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No vault configured"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("disables upload until a file is chosen", () => {
    render(<VaultMemoUpload />);
    fireEvent.click(screen.getByRole("button", { name: "ADD MEMO" }));
    expect((screen.getByRole("button", { name: "UPLOAD" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
