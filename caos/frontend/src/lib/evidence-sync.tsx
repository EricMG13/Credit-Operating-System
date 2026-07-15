"use client";

// Cross-pane "Evidence Sync" selection store (Blueprint §4). A single focused
// evidence id is shared across the Deep-Dive: hovering or focusing any E-xx
// chip publishes its id; every other chip with that id — and every CP-5B source
// driver that cites it — subscribes and highlights, so a claim lights up its
// own provenance across panes. Panes stay decoupled: none calls another
// directly, they only publish/subscribe to this id.
//
// The default context is inert (no-op setter), so EvChip works unchanged on
// pages that don't mount the provider — the sync only activates under it.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface EvidenceSync {
  /** The focused evidence id (E-xx), or null. */
  active: string | null;
  setActive: (id: string | null) => void;
}

const Ctx = createContext<EvidenceSync>({ active: null, setActive: () => {} });

export function useEvidenceSync() {
  return useContext(Ctx);
}

export function EvidenceSyncProvider({ children, initialActive = null }: { children: ReactNode; initialActive?: string | null }) {
  const [active, setActive] = useState<string | null>(initialActive);
  useEffect(() => setActive(initialActive), [initialActive]);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
