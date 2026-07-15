import { describe, expect, it, vi } from "vitest";

import { ensureIssuerScope } from "@/components/upload/context";
import type { AnalysisContext } from "@/lib/analysis-workbench";

const context = {
  id: "context-1",
  revision: 1,
  name: "Upload",
  sector_id: null,
  issuer_ids: [],
  instrument_ids: [],
  sub_segments: [],
  portfolio_scope: null,
  as_of: null,
  sector_review_run_id: null,
  rv_snapshot_id: null,
  rv_run_id: null,
  query_session_id: null,
  artifacts: {
    issuer_run_id: null,
    source_manifest_id: null,
    research_job_id: null,
    model_checkpoint_id: null,
    report_version_id: null,
    alert_event_id: null,
    sponsor_id: null,
  },
  surface_state: {},
  filters: {},
  selected: {},
  created_at: "2026-07-13T00:00:00Z",
  updated_at: "2026-07-13T00:00:00Z",
} satisfies AnalysisContext;

describe("UploadWizard issuer scoping", () => {
  it("awaits the scope patch and returns the server context used by run creation", async () => {
    let resolvePatch: (value: AnalysisContext) => void = () => undefined;
    const patch = vi.fn(() => new Promise<AnalysisContext>((resolve) => {
      resolvePatch = resolve;
    }));
    const pending = ensureIssuerScope(context, "issuer-1", patch);

    expect(patch).toHaveBeenCalledWith({ issuer_ids: ["issuer-1"] });
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    const scoped = { ...context, issuer_ids: ["issuer-1"] };
    resolvePatch(scoped);
    await expect(pending).resolves.toBe(scoped);
  });

  it("does not patch an already-scoped context", async () => {
    const scoped = { ...context, issuer_ids: ["issuer-1"] };
    const patch = vi.fn();
    await expect(ensureIssuerScope(scoped, "issuer-1", patch)).resolves.toBe(scoped);
    expect(patch).not.toHaveBeenCalled();
  });
});
