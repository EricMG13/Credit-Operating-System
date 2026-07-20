"use client";

// Undo/redo buttons + a named-checkpoint save/restore/delete modal for Model
// Builder's manual overrides (G3, design-rebuild WP-2). Undo/redo are the
// primary action (visible, always-mounted buttons); checkpoints are the
// secondary, occasional action (a small modal), matching Sam's "shared modal
// primitives for every dialog" resolution (useModalA11y + ModalBackdrop, the
// same pair ModuleFinder's ⌘M combobox uses).

import { useEffect, useRef, useState } from "react";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { ActionReason } from "@/components/shared/ActionReason";
import type { ModelCheckpoint } from "@/lib/model/useModelHistory";
import { fmtLocalDateTime } from "@/lib/format-date";

const BTN =
  "tabular text-caos-xs px-1.5 h-6 min-w-6 rounded border transition-caos focus-ring whitespace-nowrap border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 aria-disabled:opacity-40 aria-disabled:hover:text-caos-muted aria-disabled:hover:border-caos-border aria-disabled:cursor-not-allowed";

export function ModelHistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  checkpoints,
  onCheckpoint,
  onRestore,
  onDelete,
  disabled = false,
  status = "ready",
  error = null,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  checkpoints: ModelCheckpoint[];
  onCheckpoint: (name: string) => Promise<boolean>;
  onRestore: (id: string) => boolean;
  onDelete: (id: string) => Promise<boolean>;
  disabled?: boolean;
  status?: "loading" | "ready" | "saving" | "error";
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Override history">
      <button type="button" onClick={onUndo} aria-disabled={!canUndo || undefined} title="Undo (⌘Z)" aria-label="Undo" className={BTN}>
        ↶
      </button>
      <button type="button" onClick={onRedo} aria-disabled={!canRedo || undefined} title="Redo (⌘⇧Z)" aria-label="Redo" className={BTN}>
        ↷
      </button>
      <button
        type="button"
        onClick={() => { if (disabled || status === "loading" || status === "saving") return; setOpen(true); }}
        aria-disabled={(disabled || status === "loading" || status === "saving") || undefined}
        title="Save or restore a named snapshot of your overrides"
        className={BTN + " px-2"}
      >
        ⚑ CHECKPOINTS{checkpoints.length ? ` (${checkpoints.length})` : ""}
      </button>
      {open ? (
        <CheckpointsModal
          onClose={() => setOpen(false)}
          checkpoints={checkpoints}
          onCheckpoint={onCheckpoint}
          onRestore={onRestore}
          onDelete={onDelete}
          status={status}
          error={error}
        />
      ) : null}
    </div>
  );
}

function CheckpointsModal({
  onClose,
  checkpoints,
  onCheckpoint,
  onRestore,
  onDelete,
  status,
  error,
}: {
  onClose: () => void;
  checkpoints: ModelCheckpoint[];
  onCheckpoint: (name: string) => Promise<boolean>;
  onRestore: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  status: "loading" | "ready" | "saving" | "error";
  error: string | null;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    if (await onCheckpoint(name)) setName("");
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Model checkpoints"
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] max-w-[92vw] max-h-[70vh] flex flex-col rounded-md border border-caos-border bg-caos-panel shadow-2xl overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-caos-border flex items-center gap-2">
          <input
            ref={inputRef}
            name="checkpoint-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void save(); }
            }}
            placeholder="Name this checkpoint…"
            aria-label="Checkpoint name"
            className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted min-h-9"
          />
          <ActionReason
            onClick={() => void save()}
            reason={
              !name.trim()
                ? "Enter a checkpoint name first"
                : status === "loading"
                ? "Checkpoints are loading"
                : status === "saving"
                ? "Saving…"
                : null
            }
            className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-caos-accent whitespace-nowrap"
          >
            Save
          </ActionReason>
        </div>
        {error ? <div role="alert" className="border-b border-caos-border px-3 py-2 text-caos-xs text-caos-critical">{error}</div> : null}
        <ul aria-label="Saved checkpoints" className="flex-1 overflow-y-auto py-1">
          {checkpoints.length === 0 ? (
            <li className="px-3 py-4 tabular text-caos-xs text-caos-muted">
              No checkpoints yet — name and save one above. Capped at 10; the oldest drops off.
            </li>
          ) : (
            checkpoints.map((cp) => (
              <li key={cp.id} className="flex items-center gap-2 px-3 min-h-9 py-1.5 border-b border-caos-border/50 last:border-0">
                <span className="tabular text-caos-md text-caos-text truncate flex-1 min-w-0">{cp.name}</span>
                <span className="tabular text-caos-3xs text-caos-muted whitespace-nowrap">
                  {fmtLocalDateTime(cp.at)}
                </span>
                <button
                  type="button"
                  onClick={() => { onRestore(cp.id); onClose(); }}
                  className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target whitespace-nowrap"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(cp.id)}
                  title="Delete checkpoint"
                  aria-label={`Delete checkpoint ${cp.name}`}
                  className="tabular text-caos-xs px-1.5 min-h-8 min-w-8 rounded border border-caos-border text-caos-muted hover:text-caos-critical hover:border-caos-critical/60 transition-caos focus-ring caos-target"
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </ModalBackdrop>
  );
}
