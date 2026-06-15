"use client";

// Global "Ask" launcher — one entry point to the conversational surface, scoped
// by where the analyst is. ⌘K / Ctrl+K toggles it from anywhere (Esc closes).
// On the issuer-scoped concepts (Deep-Dive, Model) it opens the ATLF issuer Q&A;
// elsewhere it opens the cross-issuer NL query. Deep-Dive owns its own
// evidence-synced chat (rendered inside its EvidenceSyncProvider) and only reads
// `open` from this context, so the launcher never double-mounts a chat there.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IssuerChat } from "@/components/deepdive/IssuerChat";
import { NlQueryBody } from "@/components/command/NlQuery";

interface AskCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<AskCtx>({ open: false, setOpen: () => {}, toggle: () => {} });

export const useAsk = () => useContext(Ctx);

export function AskProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const value = useMemo(() => ({ open, setOpen, toggle: () => setOpen((v) => !v) }), [open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Where the conversation is scoped. Deep-Dive is split out because it renders
// its own evidence-aware chat from `open`.
function scopeFor(pathname: string): "deepdive" | "issuer" | "cross" {
  if (pathname.startsWith("/deepdive")) return "deepdive";
  if (pathname.startsWith("/model")) return "issuer";
  return "cross";
}

export function AskLauncher() {
  const { open, setOpen, toggle } = useAsk();
  const pathname = usePathname() || "";
  const scope = scopeFor(pathname);

  // Close on navigation — the overlay is transient, so changing concept
  // shouldn't carry a stale Ask (or pop the wrong-scope surface on arrival).
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  // Floating trigger, hidden while open. Deep-Dive also has an in-panel ASK
  // button, but this keeps ⌘K discoverable everywhere.
  const trigger = !open ? (
    <button
      onClick={toggle}
      title="Ask CAOS (⌘K) — cross-issuer query, or issuer Q&A in Deep-Dive / Model"
      className="fixed bottom-3 left-3 z-overlay flex items-center gap-1.5 tabular text-caos-md px-2.5 py-1.5 rounded-full border border-caos-accent/60 bg-caos-panel text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
      style={{ boxShadow: "var(--shadow-pop)" }}
    >
      <span className="text-caos-2xl">✦</span> Ask
      <span className="tabular text-caos-2xs px-1 rounded border border-caos-border opacity-80">⌘K</span>
    </button>
  ) : null;

  // Deep-Dive renders its own chat from `open`; the launcher only supplies the trigger.
  if (scope === "deepdive") return trigger;
  if (!open) return trigger;

  // Model and other issuer-scoped concepts → the ATLF issuer Q&A slide-over.
  if (scope === "issuer") {
    return <>{trigger}<IssuerChat tab="M-118" onClose={() => setOpen(false)} /></>;
  }

  // Everywhere else → the cross-issuer NL query, as a centered modal.
  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center p-6 pt-[12vh]"
      style={{ background: "rgba(5,5,7,0.72)" }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="caos-enter bg-caos-panel border border-caos-accent/60 rounded-md w-full max-w-2xl max-h-[78vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="h-9 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70 shrink-0">
          <span className="text-caos-accent text-caos-2xl">✦</span>
          <span className="tabular text-caos-xl text-caos-text whitespace-nowrap">Ask across issuers</span>
          <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-muted whitespace-nowrap hidden sm:inline">
            grounded in the metric store · cited where run-derived
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            title="Close (Esc)"
            className="w-5 h-5 rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-caos-md"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <NlQueryBody />
        </div>
      </div>
    </div>
  );
}
