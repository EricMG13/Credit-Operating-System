// @vitest-environment jsdom
// M-8 — the query-history rehydrate effect (page.tsx ~L147) parses
// localStorage["caos:query-history"] with no shape validation. This locks the
// fix: malformed JSON must not crash the effect/page, and valid-JSON-but-wrong-
// shape (e.g. a plain object instead of an array) must not be accepted into
// history either — both fall back to an empty history rather than a garbage
// render or a downstream .slice()/.map() crash on a non-array.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/query",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Module-level, not inline in the factory: page.tsx's run() is a useCallback
// keyed on [notify], and the real useNotify() returns a stable reference
// (Notifications.tsx wraps it in useCallback/useMemo). An inline arrow here
// returns a NEW function every call, so run() — and the useEffect keyed on
// [run] that loads capabilities — recreates every render, infinite-looping.
const NOOP_NOTIFY = () => {};
vi.mock("@/components/shared/Notifications", () => ({ useNotify: () => NOOP_NOTIFY }));

// Stub every heavy child so the page renders offline + deterministically —
// only the command bar / Recent dropdown is under test here.
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => <div data-testid="g2-chart" /> }));
vi.mock("@/components/command/CitationViewer", () => ({
  CitationViewer: () => <div data-testid="citation-viewer" />,
}));
vi.mock("@/components/query/GroupLauncher", () => ({
  GroupLauncher: () => <div data-testid="group-launcher" />,
}));
vi.mock("@/components/query/EvidenceDock", () => ({
  EvidenceDock: () => <div data-testid="evidence-dock" />,
}));
vi.mock("@/components/query/VaultMemoUpload", () => ({
  VaultMemoUpload: () => <div data-testid="vault-memo-upload" />,
}));
vi.mock("@/components/query/InsightFeed", () => ({
  InsightFeed: () => <div data-testid="insight-feed" />,
}));
vi.mock("@/components/query/AiAnswer", () => ({
  AiAnswer: () => <div data-testid="ai-answer" />,
}));
vi.mock("@/components/query/GraphCanvas", () => ({
  GraphCanvas: () => <div data-testid="graph-canvas" />,
}));
vi.mock("@/components/query/RelativeValueTable", () => ({
  RelativeValueTable: () => <div data-testid="rv-table" />,
}));
vi.mock("@/components/query/ScatterCanvas", () => ({
  ScatterCanvas: () => <div data-testid="scatter-canvas" />,
}));
vi.mock("@/components/query/LineageFlow", () => ({
  LineageFlow: () => <div data-testid="lineage-flow" />,
}));
vi.mock("@/components/query/QueryPrintSheet", () => ({
  QueryPrintSheet: () => <div data-testid="query-print-sheet" />,
}));
vi.mock("@/components/query/QueryReportSheet", () => ({
  QueryReportSheet: () => <div data-testid="query-report-sheet" />,
}));
vi.mock("@/components/query/ReportRail", () => ({
  ReportRail: () => <div data-testid="report-rail" />,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  // No capabilities → no auto-walk, no "Runnable now" prompts — so the dropdown
  // only ever shows the "Recent" section, isolating what history rendered.
  queryCapabilities: vi.fn().mockResolvedValue({ groups: [], availability: { model_lane: false } }),
  queryInsights: vi.fn().mockResolvedValue({ cards: [], refreshing: false }),
  queryGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [], caveats: [], capability_id: "peer-set", mode: "peer", title: "peers" }),
  queryRoute: vi.fn().mockResolvedValue({ candidates: [], source: "keyword" }),
  queryAnswer: vi.fn().mockResolvedValue({ answer: "", sentences: [], citations: [], unavailable: true, model: null, created_at: null, cached: false }),
  queryOverlay: vi.fn().mockResolvedValue({ edges: [], commentary: null, model: null, cached: false }),
  listQueryLinks: vi.fn().mockResolvedValue({ links: [] }),
  acceptQueryLink: vi.fn(),
  retractQueryLink: vi.fn(),
  nlQuery: vi.fn(),
}));

import QueryPage from "./page";

const HISTORY_KEY = "caos:query-history";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// Opens the command-bar dropdown (focus the input) and returns whether the
// "Recent" group rendered — the only observable surface of `history` state.
async function openDropdownAndCheckRecent(): Promise<boolean> {
  const input = await screen.findByLabelText("Query coverage");
  fireEvent.focus(input);
  return screen.queryByText("Recent") !== null;
}

describe("Query · history rehydrate (M-8 localStorage shape validation)", () => {
  it("malformed JSON in localStorage does not crash the page and falls back to empty history", async () => {
    localStorage.setItem(HISTORY_KEY, "{not valid json");

    expect(() => render(<QueryPage />)).not.toThrow();
    expect(await openDropdownAndCheckRecent()).toBe(false);
  });

  it("valid JSON with the wrong shape (a plain object, not an array) is rejected — no crash, empty history", async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ text: "not an array", capId: "x", capLabel: "X" }));

    expect(() => render(<QueryPage />)).not.toThrow();
    expect(await openDropdownAndCheckRecent()).toBe(false);
  });

  it("malformed ELEMENTS ([null], wrong-typed text) are filtered out — no crash, valid entries kept", async () => {
    // Array.isArray alone let [null] / {text: 42} through: null crashed the
    // Recent dropdown render (h.text on null) on every visit until storage was
    // hand-cleared — a durable /query DoS. Valid entries must survive the filter.
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        null,
        { text: 42, capId: "peer-set", capLabel: "Peer Set" },
        { capId: "no-text", capLabel: "X" },
        { text: "which issuers are most levered", capId: "peer-set", capLabel: "Peer Set" },
      ]),
    );

    expect(() => render(<QueryPage />)).not.toThrow();
    expect(await openDropdownAndCheckRecent()).toBe(true); // the one valid entry survives
    expect(screen.getByText(/which issuers are most levered/)).toBeTruthy();
  });

  it("a well-formed history array is still accepted and rendered (control case)", async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ text: "which issuers are most levered", capId: "peer-set", capLabel: "Peer Set" }]),
    );

    render(<QueryPage />);
    expect(await openDropdownAndCheckRecent()).toBe(true);
    expect(screen.getByText(/which issuers are most levered/)).toBeTruthy();
  });
});
