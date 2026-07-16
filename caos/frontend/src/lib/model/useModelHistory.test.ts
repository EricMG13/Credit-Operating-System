// @vitest-environment jsdom
// TDD lock for G3: undo/redo + named checkpoints on the Model Builder's
// manual overrides. Checkpoint persistence mirrors ModuleFinder's
// pins/recents contract (deepdive_pins) — same read-modify-write wrapper,
// same silent-swallow-on-failure behavior.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useModelHistory } from "./useModelHistory";
import { getAnalystSettings, updateAnalystWorkspace } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAnalystSettings: vi.fn(),
  updateAnalystWorkspace: vi.fn(),
}));

const mockGetAnalystSettings = vi.mocked(getAnalystSettings);
const mockUpdateAnalystWorkspace = vi.mocked(updateAnalystWorkspace);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function emptySettings(workspace: Record<string, unknown> = {}) {
  return { model_lanes: {}, email_intelligence: { approved_senders: [] }, workspace };
}

function mockWorkspaceServer(initial: Record<string, unknown> = {}) {
  let workspace = initial;
  mockUpdateAnalystWorkspace.mockImplementation(async (patch) => {
    workspace = patch(workspace);
    return emptySettings(workspace);
  });
}

describe("useModelHistory · undo/redo", () => {
  it("undo reverts the most recent setOverrides edit; redo reapplies it", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toEqual([]));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    expect(result.current.overrides).toEqual({ "q1:rev": 10 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.overrides).toEqual({});
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.overrides).toEqual({ "q1:rev": 10 });
    expect(result.current.canRedo).toBe(false);
  });

  it("undoes a sequence of edits in the correct reverse order", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toEqual([]));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    act(() => result.current.setOverrides((o) => ({ ...o, "q2:rev": 20 })));
    act(() => result.current.setOverrides((o) => ({ ...o, "q3:rev": 30 })));
    expect(result.current.overrides).toEqual({ "q1:rev": 10, "q2:rev": 20, "q3:rev": 30 });

    act(() => result.current.undo());
    expect(result.current.overrides).toEqual({ "q1:rev": 10, "q2:rev": 20 });
    act(() => result.current.undo());
    expect(result.current.overrides).toEqual({ "q1:rev": 10 });
    act(() => result.current.undo());
    expect(result.current.overrides).toEqual({});
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    act(() => result.current.redo());
    expect(result.current.overrides).toEqual({ "q1:rev": 10, "q2:rev": 20 });
  });

  it("a fresh edit after an undo discards the redo branch", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toEqual([]));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.setOverrides({ "q1:rev": 99 }));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.redo()); // no-op, nothing to redo
    expect(result.current.overrides).toEqual({ "q1:rev": 99 });
  });

  it("undo/redo are no-ops at the stack boundaries", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toEqual([]));

    act(() => result.current.undo()); // nothing to undo yet
    expect(result.current.overrides).toEqual({});
    act(() => result.current.redo()); // nothing to redo either
    expect(result.current.overrides).toEqual({});
  });

  it("replaceOverrides (hydration) does not push an undo step and resets any existing history", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toEqual([]));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.replaceOverrides({ "q1:rev": 500 }));
    expect(result.current.overrides).toEqual({ "q1:rev": 500 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo()); // history was reset — no-op
    expect(result.current.overrides).toEqual({ "q1:rev": 500 });
  });

  it("switching issuerId resets history and reloads that issuer's own checkpoints", async () => {
    mockGetAnalystSettings
      .mockResolvedValueOnce(emptySettings())
      .mockResolvedValueOnce(emptySettings({
        model_checkpoints: { "issuer-2": [{ id: "cp-1", name: "Base case", at: "2026-01-01T00:00:00Z", overrides: { "q1:rev": 1 } }] },
      }));
    const { result, rerender } = renderHook(({ issuerId }) => useModelHistory(issuerId), {
      initialProps: { issuerId: "issuer-1" },
    });
    await waitFor(() => expect(result.current.checkpoints).toEqual([]));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    expect(result.current.canUndo).toBe(true);

    rerender({ issuerId: "issuer-2" });
    await waitFor(() => expect(result.current.checkpoints).toHaveLength(1));
    expect(result.current.checkpoints[0].name).toBe("Base case");
    // issuer-1's edit history must not leak into issuer-2.
    expect(result.current.canUndo).toBe(false);
  });
});

describe("useModelHistory · checkpoints", () => {
  it("checkpoint() snapshots the current overrides, persists it per-issuer, and ignores a blank name", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    mockWorkspaceServer();
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    await act(async () => { await result.current.checkpoint("Sponsor base case"); });

    expect(result.current.checkpoints).toHaveLength(1);
    expect(result.current.checkpoints[0]).toMatchObject({ name: "Sponsor base case", overrides: { "q1:rev": 10 } });
    await waitFor(() => expect(mockUpdateAnalystWorkspace).toHaveBeenCalledTimes(1));
    const written = mockUpdateAnalystWorkspace.mock.calls[0][0]({});
    expect((written.model_checkpoints as Record<string, unknown>)["issuer-1"]).toHaveLength(1);

    await act(async () => { await result.current.checkpoint("   "); });
    expect(result.current.checkpoints).toHaveLength(1); // blank name ignored, no second write
  });

  it("caps checkpoints at 10, dropping the oldest", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    mockWorkspaceServer();
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    for (let i = 0; i < 11; i++) {
      await act(async () => { await result.current.checkpoint(`cp-${i}`); });
    }
    expect(result.current.checkpoints).toHaveLength(10);
    expect(result.current.checkpoints[0].name).toBe("cp-10"); // newest first
    expect(result.current.checkpoints.some((c) => c.name === "cp-0")).toBe(false); // oldest dropped
  });

  it("restoreCheckpoint applies the snapshot as an undoable edit", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    mockWorkspaceServer();
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    await act(async () => { await result.current.checkpoint("v1"); });
    act(() => result.current.setOverrides((o) => ({ ...o, "q2:rev": 20 })));

    const cpId = result.current.checkpoints[0].id;
    act(() => result.current.restoreCheckpoint(cpId));
    expect(result.current.overrides).toEqual({ "q1:rev": 10 });

    // Restore itself is undoable — it doesn't erase the edit history.
    act(() => result.current.undo());
    expect(result.current.overrides).toEqual({ "q1:rev": 10, "q2:rev": 20 });
  });

  it("restoreCheckpoint with an unknown id is a harmless no-op", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    act(() => result.current.setOverrides({ "q1:rev": 10 }));
    act(() => result.current.restoreCheckpoint("nonexistent"));
    expect(result.current.overrides).toEqual({ "q1:rev": 10 });
  });

  it("deleteCheckpoint removes it locally and persists the trimmed list", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    mockWorkspaceServer();
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    await act(async () => { await result.current.checkpoint("v1"); });
    const cpId = result.current.checkpoints[0].id;
    await act(async () => { await result.current.deleteCheckpoint(cpId); });
    expect(result.current.checkpoints).toEqual([]);
    await waitFor(() => expect(mockUpdateAnalystWorkspace).toHaveBeenCalledTimes(2)); // create + delete
  });

  it("loads only well-formed checkpoints for this issuer, dropping malformed entries", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings({
      model_checkpoints: {
        "issuer-1": [
          { id: "cp-1", name: "Good", at: "2026-01-01T00:00:00Z", overrides: { "q1:rev": 1 } },
          { id: "cp-2" }, // malformed — missing name/at/overrides
          "not-an-object",
        ],
        "issuer-other": [{ id: "cp-3", name: "Other issuer's", at: "2026-01-01T00:00:00Z", overrides: {} }],
      },
    }));
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toHaveLength(1));
    expect(result.current.checkpoints[0].name).toBe("Good");
  });

  it("surfaces a checkpoint load failure and blocks writes for an unknown issuer workspace", async () => {
    mockGetAnalystSettings.mockRejectedValue(new Error("no profile row"));
    mockUpdateAnalystWorkspace.mockRejectedValue(new Error("no profile row"));
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("error"));

    expect(await result.current.checkpoint("must not cross the boundary")).toBe(false);
    expect(result.current.checkpoints).toHaveLength(0);
    expect(mockUpdateAnalystWorkspace).not.toHaveBeenCalled();
    expect(result.current.persistenceError).toBeTruthy();
  });

  it("keeps failed saves out of local state and permits an explicit retry", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    mockUpdateAnalystWorkspace
      .mockRejectedValueOnce(new Error("write failed"))
      .mockImplementationOnce(async (patch) => emptySettings(patch({})));
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    await act(async () => {
      expect(await result.current.checkpoint("Base case")).toBe(false);
    });
    expect(result.current.checkpoints).toEqual([]);
    expect(result.current.persistenceState).toBe("error");

    await act(async () => {
      expect(await result.current.checkpoint("Base case")).toBe(true);
    });
    expect(result.current.checkpoints).toHaveLength(1);
    expect(result.current.persistenceState).toBe("ready");
  });

  it("rebases create on the current server issuer list and preserves a concurrent checkpoint", async () => {
    mockGetAnalystSettings.mockResolvedValue(emptySettings());
    const remote = { id: "remote", name: "Other tab", at: "2026-01-01T00:00:00Z", overrides: { "q1:rev": 7 } };
    mockWorkspaceServer({ model_checkpoints: { "issuer-1": [remote] } });
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.persistenceState).toBe("ready"));

    await act(async () => { expect(await result.current.checkpoint("This tab")).toBe(true); });

    expect(result.current.checkpoints.map((item) => item.name)).toEqual(["This tab", "Other tab"]);
  });

  it("rebases delete on the current server issuer list and preserves a concurrent checkpoint", async () => {
    const local = { id: "local", name: "Delete me", at: "2026-01-01T00:00:00Z", overrides: {} };
    const remote = { id: "remote", name: "Other tab", at: "2026-01-02T00:00:00Z", overrides: {} };
    mockGetAnalystSettings.mockResolvedValue(emptySettings({ model_checkpoints: { "issuer-1": [local] } }));
    mockWorkspaceServer({ model_checkpoints: { "issuer-1": [local, remote] } });
    const { result } = renderHook(() => useModelHistory("issuer-1"));
    await waitFor(() => expect(result.current.checkpoints).toHaveLength(1));

    await act(async () => { expect(await result.current.deleteCheckpoint("local")).toBe(true); });

    expect(result.current.checkpoints).toEqual([remote]);
  });
});
