"use client";

// Global "Ask" launcher — one entry point to the conversational surface, scoped
// by where the analyst is. ⌘K / Ctrl+K toggles it from anywhere (Esc closes).
// On the issuer-scoped concepts (Deep-Dive, Model) it opens the ATLF issuer Q&A;
// elsewhere it opens the cross-issuer NL query. Deep-Dive owns its own
// evidence-synced chat (rendered inside its EvidenceSyncProvider) and only reads
// `open` from this context, so the launcher never double-mounts a chat there.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { usePathname } from "next/navigation";
import { IssuerChat } from "@/components/deepdive/IssuerChat";
import { NlQueryBody } from "@/components/command/NlQuery";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { useAuth } from "@/components/shared/AuthProvider";

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
    // fallow-ignore-next-line complexity
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

// fallow-ignore-next-line complexity
export function AskLauncher() {
  const { open, setOpen, toggle } = useAsk();
  const { user, needsLogin } = useAuth();
  const pathname = usePathname() || "";
  const scope = scopeFor(pathname);

  // Close on navigation — the overlay is transient, so changing concept
  // shouldn't carry a stale Ask (or pop the wrong-scope surface on arrival).
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  // Gate on a signed-in profile: Ask queries need an analyst identity, and the
  // launcher must not float over the login landing (it sits in the root layout,
  // outside RequireAuth). Loading/error/needs-login all resolve to "not ready".
  if (!user || needsLogin) return null;

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
      <span className="tabular text-caos-2xs px-1 rounded border border-caos-border">⌘K</span>
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
  return <AskModal onClose={() => setOpen(false)} />;
}

// Cross-issuer NL query — a true modal (backdrop + centered panel), so it gets
// focus-trap / restore / scroll-lock + dialog semantics via useModalA11y.
function AskModal({ onClose }: { onClose: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center p-6 pt-[12vh]"
      style={{ background: "rgba(5,5,7,0.72)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask across issuers"
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
          <CloseButton onClick={onClose} title="Close (Esc)" />
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <NlQueryBody />
        </div>
      </div>
    </div>
  );
}
