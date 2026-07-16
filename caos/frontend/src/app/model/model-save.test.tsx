// @vitest-environment jsdom
// Locks the SAVE MODEL failure contract (F3): a rejected PUT surfaces a
// role=alert "SAVE FAILED" — Report Studio reads only the DB-saved model, so a
// silent failure would let committee output drift from what the analyst sees.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModelPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(), // no ?issuer → ATLF reference page
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({ anchor: null, downside: null, loading: false, run: null }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn().mockResolvedValue({ features: { model_engine_v2_enabled: false } }),
  getSavedModel: vi.fn().mockResolvedValue(null),
  saveModel: vi.fn().mockRejectedValue(new Error("boom")),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Model Builder · save to DB", () => {
  it("shows a role=alert SAVE FAILED state when the PUT rejects (F3)", async () => {
    render(<ModelPage />);
    const save = await screen.findByRole("button", { name: /SAVE MODEL/i });
    await waitFor(() => expect(save.getAttribute("aria-disabled")).toBeNull()); // the ready action omits its disabled state
    fireEvent.click(save);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("SAVE FAILED");
    });
  });
});
