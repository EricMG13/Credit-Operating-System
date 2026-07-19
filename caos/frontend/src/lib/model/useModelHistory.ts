"use client";

// Undo/redo + named checkpoints for Model Builder's manual overrides
// (G3, design-rebuild WP-2). One deep module: owns the Overrides state AND
// its history, so the page never juggles two sources of truth.
//
//   setOverrides(...)      — a user edit; pushes the PRIOR state onto `past`
//                            and clears `future` (a fresh edit kills any redo
//                            branch, same as every spreadsheet/editor).
//   replaceOverrides(...)  — hydration (localStorage / DB restore); resets
//                            history instead of pushing to it — a reload must
//                            not offer to "undo" back to an empty draft.
//   checkpoint(name)       — a named snapshot, persisted to the analyst's
//                            workspace settings (updateAnalystWorkspace, the
//                            same read-modify-write wrapper deepdive_pins
//                            uses), keyed per-issuer so ATLF's checkpoints
//                            never bleed into a live issuer's list. Capped at
//                            10 (oldest dropped) — same bound as pins.
//
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Overrides } from "@/lib/reports/model";
import { getAnalystSettings, toErrorMessage, updateAnalystWorkspace } from "@/lib/api";

export interface ModelCheckpoint {
  id: string;
  name: string;
  /** ISO timestamp. */
  at: string;
  overrides: Overrides;
}

const MAX_CHECKPOINTS = 10;
const MAX_UNDO_DEPTH = 100;

function isCheckpoint(v: unknown): v is ModelCheckpoint {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.at === "string" &&
    !!c.overrides &&
    typeof c.overrides === "object" &&
    !Array.isArray(c.overrides) &&
    Object.values(c.overrides as Record<string, unknown>).every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  );
}

function readCheckpoints(ws: Record<string, unknown> | undefined, issuerId: string): ModelCheckpoint[] {
  const all = ws?.model_checkpoints;
  if (!all || typeof all !== "object") return [];
  const list = (all as Record<string, unknown>)[issuerId];
  return Array.isArray(list) ? list.filter(isCheckpoint) : [];
}

function writeCheckpoints(ws: Record<string, unknown>, issuerId: string, list: ModelCheckpoint[]): Record<string, unknown> {
  const all = ws.model_checkpoints && typeof ws.model_checkpoints === "object"
    ? { ...(ws.model_checkpoints as Record<string, unknown>) }
    : {};
  all[issuerId] = list;
  return { ...ws, model_checkpoints: all };
}

export interface UseModelHistory {
  overrides: Overrides;
  setOverrides: (updater: Overrides | ((prev: Overrides) => Overrides)) => void;
  replaceOverrides: (next: Overrides) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  checkpoints: ModelCheckpoint[];
  checkpoint: (name: string) => Promise<boolean>;
  restoreCheckpoint: (id: string) => boolean;
  deleteCheckpoint: (id: string) => Promise<boolean>;
  persistenceState: "loading" | "ready" | "saving" | "error";
  persistenceError: string | null;
}

const useOverrideHistory = () => {
  const [overrides, setOverridesState] = useState<Overrides>({});
  const past = useRef<Overrides[]>([]);
  const future = useRef<Overrides[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncFlags = () => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  };
  const clearHistory = useCallback((next: Overrides = {}) => {
    setOverridesState(next);
    past.current = [];
    future.current = [];
    syncFlags();
  }, []);
  const setOverrides = useCallback((updater: Overrides | ((prev: Overrides) => Overrides)) => {
    setOverridesState((previous) => {
      const next = typeof updater === "function"
        ? (updater as (value: Overrides) => Overrides)(previous)
        : updater;
      if (next === previous) return previous;
      past.current = [...past.current, previous].slice(-MAX_UNDO_DEPTH);
      future.current = [];
      syncFlags();
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    setOverridesState((current) => {
      if (!past.current.length) return current;
      const previous = past.current.at(-1)!;
      past.current = past.current.slice(0, -1);
      future.current = [current, ...future.current];
      syncFlags();
      return previous;
    });
  }, []);
  const redo = useCallback(() => {
    setOverridesState((current) => {
      if (!future.current.length) return current;
      const [next, ...rest] = future.current;
      future.current = rest;
      past.current = [...past.current, current];
      syncFlags();
      return next;
    });
  }, []);
  return {
    overrides,
    setOverrides,
    replaceOverrides: clearHistory,
    clearHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};

const useCheckpointStore = (issuerId: string, clearHistory: (next?: Overrides) => void) => {
  const [checkpoints, setCheckpoints] = useState<ModelCheckpoint[]>([]);
  const [persistenceState, setPersistenceState] = useState<UseModelHistory["persistenceState"]>("loading");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const loadedIssuer = useRef<string | null>(null);
  const persistenceBusy = useRef(false);
  const checkpointsRef = useRef<ModelCheckpoint[]>([]);
  checkpointsRef.current = checkpoints;
  useEffect(() => {
    loadedIssuer.current = null;
    persistenceBusy.current = false;
    clearHistory();
    setCheckpoints([]);
    setPersistenceState("loading");
    setPersistenceError(null);
    let alive = true;
    getAnalystSettings()
      .then((settings) => {
        if (!alive) return;
        loadedIssuer.current = issuerId;
        setCheckpoints(readCheckpoints(settings.workspace, issuerId));
        setPersistenceState("ready");
      })
      .catch((reason) => {
        if (!alive) return;
        const localBypass = axios.isAxiosError(reason) && reason.response?.status === 404;
        if (localBypass) {
          loadedIssuer.current = issuerId;
          setPersistenceState("ready");
          return;
        }
        setPersistenceState("error");
        setPersistenceError(toErrorMessage(reason, "Model checkpoints could not be loaded."));
      });
    return () => { alive = false; };
  }, [clearHistory, issuerId]);
  return {
    checkpoints,
    setCheckpoints,
    persistenceState,
    setPersistenceState,
    persistenceError,
    setPersistenceError,
    loadedIssuer,
    persistenceBusy,
    checkpointsRef,
  };
};

type CheckpointStore = ReturnType<typeof useCheckpointStore>;

const checkpointActionReady = (store: CheckpointStore, issuerId: string): boolean =>
  store.loadedIssuer.current === issuerId
  && !store.persistenceBusy.current
  && store.persistenceState !== "loading";

const persistCheckpointMutation = async (
  store: CheckpointStore,
  issuerId: string,
  update: Parameters<typeof updateAnalystWorkspace>[0],
  errorMessage: string,
): Promise<boolean> => {
  store.persistenceBusy.current = true;
  store.setPersistenceState("saving");
  store.setPersistenceError(null);
  try {
    const saved = await updateAnalystWorkspace(update);
    if (store.loadedIssuer.current !== issuerId) return false;
    store.setCheckpoints(readCheckpoints(saved.workspace, issuerId));
    store.persistenceBusy.current = false;
    store.setPersistenceState("ready");
    return true;
  } catch (reason) {
    if (store.loadedIssuer.current === issuerId) {
      store.persistenceBusy.current = false;
      store.setPersistenceState("error");
      store.setPersistenceError(toErrorMessage(reason, errorMessage));
    }
    return false;
  }
};

const useCheckpointActions = (
  issuerId: string,
  overrides: Overrides,
  setOverrides: UseModelHistory["setOverrides"],
  store: CheckpointStore,
) => {
  const checkpoint = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !checkpointActionReady(store, issuerId)) return false;
    const next: ModelCheckpoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      at: new Date().toISOString(),
      overrides,
    };
    return persistCheckpointMutation(
      store,
      issuerId,
      (workspace) => {
        const current = readCheckpoints(workspace, issuerId);
        const list = [next, ...current.filter((candidate) => candidate.id !== next.id)].slice(0, MAX_CHECKPOINTS);
        return writeCheckpoints(workspace, issuerId, list);
      },
      "Checkpoint could not be saved.",
    );
  }, [issuerId, overrides, store]);
  const restoreCheckpoint = useCallback((id: string) => {
    if (!checkpointActionReady(store, issuerId)) return false;
    const checkpoint = store.checkpointsRef.current.find((candidate) => candidate.id === id);
    if (!checkpoint) return false;
    setOverrides(checkpoint.overrides);
    return true;
  }, [issuerId, setOverrides, store]);
  const deleteCheckpoint = useCallback(async (id: string) => {
    if (!checkpointActionReady(store, issuerId)) return false;
    if (!store.checkpointsRef.current.some((candidate) => candidate.id === id)) return false;
    return persistCheckpointMutation(
      store,
      issuerId,
      (workspace) => writeCheckpoints(
        workspace,
        issuerId,
        readCheckpoints(workspace, issuerId).filter((candidate) => candidate.id !== id),
      ),
      "Checkpoint could not be deleted.",
    );
  }, [issuerId, store]);
  return { checkpoint, restoreCheckpoint, deleteCheckpoint };
};

export function useModelHistory(issuerId: string): UseModelHistory {
  const history = useOverrideHistory();
  const store = useCheckpointStore(issuerId, history.clearHistory);
  const actions = useCheckpointActions(issuerId, history.overrides, history.setOverrides, store);

  return {
    overrides: history.overrides,
    setOverrides: history.setOverrides,
    replaceOverrides: history.replaceOverrides,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    checkpoints: store.checkpoints,
    checkpoint: actions.checkpoint,
    restoreCheckpoint: actions.restoreCheckpoint,
    deleteCheckpoint: actions.deleteCheckpoint,
    persistenceState: store.persistenceState,
    persistenceError: store.persistenceError,
  };
}
