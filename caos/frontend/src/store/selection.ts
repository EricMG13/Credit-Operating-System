import { create } from "zustand";

export type SelectionSource =
  | "scatter"
  | "covenant"
  | "narrative"
  | "vault"
  | "trace"
  | null;

interface SelectionStore {
  conclusionId: string | null;
  linkIndex: number | null; // optional: a specific evidence_chain entry (inline citation)
  source: SelectionSource;
  /** Publish a selection. Clicking the already-focused item clears it (toggle). */
  select: (conclusionId: string, source: SelectionSource, linkIndex?: number) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  conclusionId: null,
  linkIndex: null,
  source: null,
  select: (conclusionId, source, linkIndex) =>
    set(
      get().conclusionId === conclusionId && get().linkIndex === (linkIndex ?? null)
        ? { conclusionId: null, linkIndex: null, source: null }
        : { conclusionId, source, linkIndex: linkIndex ?? null }
    ),
  clear: () => set({ conclusionId: null, linkIndex: null, source: null }),
}));
