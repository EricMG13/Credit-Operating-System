import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  calculateModelV2,
  commitModelV2Workbook,
  createModelV2Checkpoint,
  exportModelV2Workbook,
  getModelV2,
  getModelV2Checkpoints,
  getModelV2History,
  mutateModelV2Override,
  mutateModelV2OverridesBatch,
  previewModelV2Workbook,
  replayModelV2Override,
  restoreModelV2Checkpoint,
  saveModelV2,
} from "@/lib/api";
import type { ModelV2DraftPayload } from "./modelV2";

const payload = { schema_version: 2 } as ModelV2DraftPayload;

describe("Model Engine v2 API routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("wires the read, calculate, and save contracts to the v2 issuer route", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: null } as never);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null } as never);
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: null } as never);

    await getModelV2("issuer/1");
    await calculateModelV2("issuer/1", { payload, context_id: "context-1" });
    await saveModelV2("issuer/1", { payload, expected_revision: 3 });

    expect(get).toHaveBeenCalledWith("/api/models/v2/issuer%2F1", {
      params: undefined,
      signal: undefined,
    });
    expect(post).toHaveBeenCalledWith(
      "/api/models/v2/issuer%2F1/calculate",
      { payload, context_id: "context-1" },
      { signal: undefined },
    );
    expect(put).toHaveBeenCalledWith(
      "/api/models/v2/issuer%2F1",
      { payload, expected_revision: 3 },
    );
  });

  it("binds an exact source run on the model read", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: null } as never);

    await getModelV2("issuer-1", "run-exact");

    expect(get).toHaveBeenCalledWith("/api/models/v2/issuer-1", {
      params: { run_id: "run-exact" },
      signal: undefined,
    });
  });

  it("wires override history, mutation, and replay without a legacy endpoint", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: [] } as never);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null } as never);

    await getModelV2History("issuer-1");
    await mutateModelV2Override("issuer-1", {
      expected_revision: 4,
      action: "reset",
      node_id: "calc:FY2026:net_debt",
    });
    await mutateModelV2OverridesBatch("issuer-1", {
      expected_revision: 5,
      mutations: [{
        action: "set",
        override: {
          node_id: "input:FY2026:revenue",
          value_type: "number",
          value: 100,
          reason: null,
          scope: "draft",
          source: "analyst-ui",
          expires_at: null,
        },
      }],
    });
    await replayModelV2Override("issuer-1", "event/1", {
      expected_revision: 6,
      mode: "undo",
    });

    expect(get).toHaveBeenCalledWith(
      "/api/models/v2/issuer-1/history",
      { signal: undefined },
    );
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/models/v2/issuer-1/overrides",
      {
        expected_revision: 4,
        action: "reset",
        node_id: "calc:FY2026:net_debt",
      },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/models/v2/issuer-1/overrides/batch",
      {
        expected_revision: 5,
        mutations: [{
          action: "set",
          override: {
            node_id: "input:FY2026:revenue",
            value_type: "number",
            value: 100,
            reason: null,
            scope: "draft",
            source: "analyst-ui",
            expires_at: null,
          },
        }],
      },
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/api/models/v2/issuer-1/history/event%2F1/replay",
      { expected_revision: 6, mode: "undo" },
    );
  });

  it("wires checkpoint list, create, and restore to the confirmed server paths", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: [] } as never);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null } as never);

    await getModelV2Checkpoints("issuer-1");
    await createModelV2Checkpoint("issuer-1", {
      context_id: "context-1",
      expected_revision: 6,
      calculation_hash: "a".repeat(64),
    });
    await restoreModelV2Checkpoint("issuer-1", "checkpoint/1", {
      expected_revision: 7,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/models/v2/issuer-1/checkpoints",
      { signal: undefined },
    );
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/models/v2/issuer-1/checkpoints",
      {
        context_id: "context-1",
        expected_revision: 6,
        calculation_hash: "a".repeat(64),
      },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/models/v2/issuer-1/checkpoints/checkpoint%2F1/restore",
      { expected_revision: 7 },
    );
  });

  it("wires strict workbook export and upload-preview-confirm-commit forms", async () => {
    const file = new File(["xlsx"], "model.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const preview = {
      workbook_sha256: "b".repeat(64),
      preview_token: "signed-preview",
      expected_revision: 9,
    } as never;
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: new Blob(["xlsx"]),
      headers: {
        "content-disposition": 'attachment; filename="issuer-model.xlsx"',
        "x-caos-model-revision": "9",
      },
    } as never);
    const post = vi.spyOn(api, "post")
      .mockResolvedValueOnce({ data: preview } as never)
      .mockResolvedValueOnce({ data: null } as never);

    const exported = await exportModelV2Workbook("issuer/1");
    await previewModelV2Workbook({ issuerId: "issuer/1", file, expectedRevision: 9 });
    await commitModelV2Workbook({ issuerId: "issuer/1", file, preview });

    expect(get).toHaveBeenCalledWith("/api/models/v2/issuer%2F1/workbook/export", { responseType: "blob" });
    expect(exported).toMatchObject({ filename: "issuer-model.xlsx", revision: 9 });
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/models/v2/issuer%2F1/workbook/import/preview",
      expect.any(FormData),
    );
    const previewForm = post.mock.calls[0][1] as FormData;
    expect(previewForm.get("file")).toBe(file);
    expect(previewForm.get("mapping")).toBe("");
    expect(previewForm.get("expected_revision")).toBe("9");
    const commitForm = post.mock.calls[1][1] as FormData;
    expect(commitForm.get("preview_sha256")).toBe("b".repeat(64));
    expect(commitForm.get("preview_token")).toBe("signed-preview");
    expect(commitForm.get("expected_revision")).toBe("9");
  });
});
