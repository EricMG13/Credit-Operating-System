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
// Checkpoint persistence failures are swallowed (matches ModuleFinder's
// pins/recents contract): a 404 from the local-dev bypass identity (no
// profile row) just means checkpoints stay local-only for the session.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Overrides } from "@/lib/reports/model";
import { getAnalystSettings, updateAnalystWorkspace } from "@/lib/api";

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
    typeof c.overrides === "object"
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
  checkpoint: (name: string) => void;
  restoreCheckpoint: (id: string) => void;
  deleteCheckpoint: (id: string) => void;
}

export function useModelHistory(issuerId: string): UseModelHistory {
  const [overrides, setOverridesState] = useState<Overrides>({});
  const past = useRef<Overrides[]>([]);
  const future = useRef<Overrides[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [checkpoints, setCheckpoints] = useState<ModelCheckpoint[]>([]);

  const syncFlags = () => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  };

  // Each issuer's edit history and checkpoint list are independent — switching
  // issuers must not let a Ctrl+Z on issuer B undo into issuer A's state.
  useEffect(() => {
    past.current = [];
    future.current = [];
    syncFlags();
    let alive = true;
    getAnalystSettings()
      .then((s) => { if (alive) setCheckpoints(readCheckpoints(s.workspace, issuerId)); })
      .catch(() => { if (alive) setCheckpoints([]); });
    return () => { alive = false; };
  }, [issuerId]);

  const setOverrides = useCallback((updater: Overrides | ((prev: Overrides) => Overrides)) => {
    setOverridesState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Overrides) => Overrides)(prev) : updater;
      if (next === prev) return prev;
      past.current = [...past.current, prev].slice(-MAX_UNDO_DEPTH);
      future.current = [];
      syncFlags();
      return next;
    });
  }, []);

  const replaceOverrides = useCallback((next: Overrides) => {
    setOverridesState(next);
    past.current = [];
    future.current = [];
    syncFlags();
  }, []);

  const undo = useCallback(() => {
    setOverridesState((prev) => {
      if (past.current.length === 0) return prev;
      const previous = past.current[past.current.length - 1];
      past.current = past.current.slice(0, -1);
      future.current = [prev, ...future.current];
      syncFlags();
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setOverridesState((prev) => {
      if (future.current.length === 0) return prev;
      const [next, ...rest] = future.current;
      future.current = rest;
      past.current = [...past.current, prev];
      syncFlags();
      return next;
    });
  }, []);

  const persistCheckpoints = useCallback((issuer: string, list: ModelCheckpoint[]) => {
    updateAnalystWorkspace((ws) => writeCheckpoints(ws, issuer, list)).catch(() => {});
  }, []);

  const checkpoint = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCheckpoints((cur) => {
      const next: ModelCheckpoint = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        at: new Date().toISOString(),
        overrides,
      };
      const list = [next, ...cur].slice(0, MAX_CHECKPOINTS);
      persistCheckpoints(issuerId, list);
      return list;
    });
  }, [overrides, issuerId, persistCheckpoints]);

  const restoreCheckpoint = useCallback((id: string) => {
    setCheckpoints((cur) => {
      const cp = cur.find((c) => c.id === id);
      if (cp) setOverrides(cp.overrides); // itself a user-undoable action
      return cur;
    });
  }, [setOverrides]);

  const deleteCheckpoint = useCallback((id: string) => {
    setCheckpoints((cur) => {
      const list = cur.filter((c) => c.id !== id);
      persistCheckpoints(issuerId, list);
      return list;
    });
  }, [issuerId, persistCheckpoints]);

  return {
    overrides, setOverrides, replaceOverrides, undo, redo, canUndo, canRedo,
    checkpoints, checkpoint, restoreCheckpoint, deleteCheckpoint,
  };
}
