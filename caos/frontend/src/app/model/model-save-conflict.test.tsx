// @vitest-environment jsdom
// Locks the SAVE MODEL optimistic-concurrency contract (pre-prod audit #6b): a
// 409 from a stale expected_updated_at (another tab saved first) surfaces a
// role=alert "SAVED ELSEWHERE" state distinct from a generic SAVE FAILED, with
// a click-to-reload affordance — never a silent overwrite of the newer save.
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
  saveModel: vi.fn().mockRejectedValue({
    isAxiosError: true,
    response: { status: 409, data: { detail: { message: "saved elsewhere" } } },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Model Builder · save conflict (409)", () => {
  it("shows a role=alert SAVED ELSEWHERE state, not the generic SAVE FAILED", async () => {
    render(<ModelPage />);
    const save = await screen.findByRole("button", { name: /SAVE MODEL/i });
    await waitFor(() => expect(save.getAttribute("aria-disabled")).toBeNull()); // the ready action omits its disabled state
    fireEvent.click(save);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("SAVED ELSEWHERE");
    });
    expect(screen.queryByText(/SAVE FAILED/)).toBeNull();
  });

  it("clicking the conflict badge clears it (reload affordance)", async () => {
    render(<ModelPage />);
    const save = await screen.findByRole("button", { name: /SAVE MODEL/i });
    await waitFor(() => expect(save.getAttribute("aria-disabled")).toBeNull()); // the ready action omits its disabled state
    fireEvent.click(save);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("SAVED ELSEWHERE");
    fireEvent.click(alert);
    await waitFor(() => {
      expect(screen.queryByText(/SAVED ELSEWHERE/)).toBeNull();
    });
  });
});
