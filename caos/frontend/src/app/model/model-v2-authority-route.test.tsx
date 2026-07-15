// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getModelV2, getSettings } from "@/lib/api";
import type { ModelV2ReadResponse } from "@/lib/engine/modelV2";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { ModelAuthorityRoute } from "./ModelAuthorityRoute";

const navigation = vi.hoisted(() => ({
  search: "issuer=issuer-1&context=context-1",
}));
const legacyModule = vi.hoisted(() => ({
  evaluations: 0,
  buildModel: vi.fn(() => ({ source: "legacy" })),
}));
const legacyBuildModel = legacyModule.buildModel;

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@/lib/reports/model", () => {
  legacyModule.evaluations += 1;
  return { buildModel: legacyBuildModel };
});
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn(),
  getModelV2: vi.fn(),
}));

const response: ModelV2ReadResponse = {
  authority: "model-engine-v2",
  record: null,
  suggested_payload: null,
  suggested_calculation: null,
  suggested_source_run_id: null,
  current_calculation: null,
  requires_recalculation: false,
  availability: "unavailable",
  detail: "No completed run.",
};

beforeEach(() => {
  navigation.search = "issuer=issuer-1&context=context-1";
  vi.mocked(getModelV2).mockResolvedValue(response);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Model route calculation authority", () => {
  it("renders v2 without importing or calling the legacy calculator when the feature is on", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      features: { model_engine_v2: true, model_engine_v2_enabled: false },
    } as never);
    const legacyRenderer = vi.fn(() => <div>legacy route</div>);

    render(
      <ModelAuthorityRoute
        renderLegacy={legacyRenderer}
        renderV2={() => <div>v2 route</div>}
      />,
    );

    expect(await screen.findByText("v2 route")).toBeTruthy();
    expect(getModelV2).toHaveBeenCalledWith("issuer-1");
    expect(legacyRenderer).not.toHaveBeenCalled();
    expect(legacyBuildModel).not.toHaveBeenCalled();
    expect(legacyModule.evaluations).toBe(0);
  });

  it("preserves the exact Pipeline run when resolving Model Engine v2", async () => {
    navigation.search = "issuer=issuer-1&context=context-1&run=run-exact";
    vi.mocked(getSettings).mockResolvedValue({
      features: { model_engine_v2: true, model_engine_v2_enabled: false },
    } as never);

    render(<ModelAuthorityRoute renderV2={() => <div>exact v2 route</div>} />);

    expect(await screen.findByText("exact v2 route")).toBeTruthy();
    expect(getModelV2).toHaveBeenCalledWith("issuer-1", "run-exact");
  });

  it("loads and calls the legacy calculator only when the feature is explicitly false", async () => {
    navigation.search = `issuer=${ATLF_REFERENCE_ISSUER_ID}&context=context-1`;
    vi.mocked(getSettings).mockResolvedValue({
      features: { model_engine_v2_enabled: false },
    } as never);

    render(
      <ModelAuthorityRoute
        renderLegacy={(runtime) => {
          runtime.buildModel(1, {} as never, undefined, {} as never);
          return <div>legacy route</div>;
        }}
        renderV2={() => <div>v2 route</div>}
      />,
    );

    expect(await screen.findByText("legacy route")).toBeTruthy();
    expect(legacyBuildModel).toHaveBeenCalledOnce();
    expect(legacyModule.evaluations).toBe(1);
    expect(getModelV2).not.toHaveBeenCalled();
  });

  it("does not render the legacy fixture calculator for a live issuer when v2 is false", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      features: { model_engine_v2_enabled: false },
    } as never);
    const legacyRenderer = vi.fn(() => <div>legacy route</div>);
    const legacyEvaluationsBefore = legacyModule.evaluations;

    render(
      <ModelAuthorityRoute
        renderLegacy={legacyRenderer}
        renderV2={() => <div>v2 route</div>}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain("Model authority unavailable");
    expect(legacyRenderer).not.toHaveBeenCalled();
    expect(legacyBuildModel).not.toHaveBeenCalled();
    expect(legacyModule.evaluations).toBe(legacyEvaluationsBefore);
    expect(getModelV2).not.toHaveBeenCalled();
  });

  it("keeps the explicit Atlas Forge reference surface on legacy when v2 is true", async () => {
    navigation.search = `issuer=${ATLF_REFERENCE_ISSUER_ID}&context=context-1`;
    vi.mocked(getSettings).mockResolvedValue({
      features: { model_engine_v2_enabled: true },
    } as never);

    render(
      <ModelAuthorityRoute
        renderLegacy={() => <div>Atlas Forge reference model</div>}
        renderV2={() => <div>v2 route</div>}
      />,
    );

    expect(await screen.findByText("Atlas Forge reference model")).toBeTruthy();
    expect(screen.queryByText("v2 route")).toBeNull();
    expect(getModelV2).not.toHaveBeenCalled();
  });

  it("fails closed when the feature capability is missing", async () => {
    vi.mocked(getSettings).mockResolvedValue({ features: {} } as never);

    render(<ModelAuthorityRoute renderV2={() => <div>v2 route</div>} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Model authority unavailable");
    expect(getModelV2).not.toHaveBeenCalled();
    expect(legacyBuildModel).not.toHaveBeenCalled();
  });

  it.each([
    ["settings read", () => vi.mocked(getSettings).mockRejectedValue(new Error("offline"))],
    ["v2 read", () => {
      vi.mocked(getSettings).mockResolvedValue({ features: { model_engine_v2_enabled: true } } as never);
      vi.mocked(getModelV2).mockRejectedValue(new Error("v2 offline"));
    }],
  ])("fails closed on a %s error", async (_label, arrange) => {
    arrange();
    render(<ModelAuthorityRoute renderV2={() => <div>v2 route</div>} />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Model authority unavailable"));
    expect(legacyBuildModel).not.toHaveBeenCalled();
  });
});
