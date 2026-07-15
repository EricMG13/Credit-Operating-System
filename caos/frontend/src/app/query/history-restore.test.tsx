// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  listQueryRuns: vi.fn().mockResolvedValue([]),
  listFindings: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/query" }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  queryCapabilities: vi.fn().mockResolvedValue({ groups: [] }),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: { id: "context-history", name: "History", sector_id: null, query_session_id: null, filters: {}, selected: {} },
    setContext: vi.fn(), patch: vi.fn(), loading: false, error: null,
  }),
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
  analysisApi: { listQueryRuns: mocks.listQueryRuns, listFindings: mocks.listFindings, createQueryRun: vi.fn(), createFinding: vi.fn() },
}));

import QueryPage from "./page";

afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe("Query persisted history", () => {
  it("loads analyst-owned server history and ignores browser-local legacy state", async () => {
    localStorage.setItem("caos:query-history", "{malformed legacy json");
    expect(() => render(<QueryPage />)).not.toThrow();
    await waitFor(() => expect(mocks.listQueryRuns).toHaveBeenCalledWith("context-history"));
  });
});
