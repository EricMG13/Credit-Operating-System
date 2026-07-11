// @vitest-environment jsdom
// Regression for a merge-introduced double-run-creation bug: runUpload's own
// auto-queue attempt (FE-1) and ResultStep's explicit "RUN ..." button (FE-2)
// were combined with no guard between them, so a successful automatic queue
// left the manual trigger rendered too — the analyst could click it and
// double-spend a second run for the same vaulted batch. The manual trigger
// must render only when there is no live automatic outcome, or it failed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResultStep } from "./steps";
import type { Issuer } from "@/types/issuers";
import type { RunQueueOutcome } from "./steps";

vi.mock("@/components/shared/IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => ({ openProfile: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ISSUER: Issuer = { id: "i1", name: "Acme Co" };

const BASE_PROPS = {
  outcomes: [{ name: "a.pdf", result: { document_id: "d1", issuer_id: "i1", minio_key: "k", chunks_created: 3, message: "ok" } }],
  selectedIssuer: ISSUER,
  modeMeta: { k: "full", code: "R-IC", label: "Full IC Committee", desc: "" },
  okCount: 1,
  failCount: 0,
  totalChunks: 3,
  uploading: false,
  progress: null,
  onReset: vi.fn(),
  onRetryFailed: vi.fn(),
  runCreating: false,
  runCreated: null,
  runError: "",
  onCreateRun: vi.fn(),
};

function renderWith(runOutcome: RunQueueOutcome | null) {
  return render(<ResultStep {...BASE_PROPS} runOutcome={runOutcome} />);
}

describe("ResultStep · run-creation double-fire guard", () => {
  it("hides the manual RUN button once the automatic queue attempt succeeded (queued)", () => {
    renderWith({ state: "queued", runId: "abc12345" });
    expect(screen.queryByRole("button", { name: /RUN FULL IC COMMITTEE/i })).toBeNull();
    expect(screen.getByText(/run queued/i)).toBeTruthy();
  });

  it("hides the manual RUN button while the automatic attempt is queuing", () => {
    renderWith({ state: "queuing" });
    expect(screen.queryByRole("button", { name: /RUN FULL IC COMMITTEE/i })).toBeNull();
  });

  it("hides the manual RUN button when a run is already active (409 dedup)", () => {
    renderWith({ state: "active" });
    expect(screen.queryByRole("button", { name: /RUN FULL IC COMMITTEE/i })).toBeNull();
  });

  it("shows the manual RUN button as a retry when the automatic attempt failed", () => {
    renderWith({ state: "failed", message: "network error" });
    expect(screen.getByRole("button", { name: /RUN FULL IC COMMITTEE/i })).toBeTruthy();
  });

  it("shows the manual RUN button when no automatic attempt happened at all", () => {
    renderWith(null);
    expect(screen.getByRole("button", { name: /RUN FULL IC COMMITTEE/i })).toBeTruthy();
  });
});
