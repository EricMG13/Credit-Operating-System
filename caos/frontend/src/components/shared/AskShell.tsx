"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/shared/AuthProvider";
import { useAsk } from "@/components/shared/AskContext";

const loadAskOpenSurface = () => import("@/components/shared/Ask").then((module) => module.AskOpenSurface);
const AskOpenSurface = dynamic(loadAskOpenSurface, {
  ssr: false,
  loading: () => <span role="status" className="sr-only">Loading Ask CAOS…</span>,
});

function prefetchAskSurface() {
  void loadAskOpenSurface().catch(() => undefined);
}

function scopeFor(pathname: string): "deepdive" | "issuer" | "cross" {
  if (pathname.startsWith("/deepdive")) return "deepdive";
  if (pathname.startsWith("/model") || pathname.startsWith("/pipeline") || pathname.startsWith("/issuers/profile"))
    return "issuer";
  return "cross";
}

/** Lightweight always-mounted trigger; the analytical Ask surface loads only when opened. */
export function AskLauncher() {
  const { open, setOpen, toggle } = useAsk();
  const { user, needsLogin } = useAuth();
  const pathname = usePathname() || "";
  const scope = scopeFor(pathname);

  useEffect(() => { setOpen(false); }, [pathname, setOpen]);
  useEffect(() => {
    if (open && scope !== "deepdive") prefetchAskSurface();
  }, [open, scope]);

  if (!user || needsLogin || pathname.startsWith("/query")) return null;

  const phoneTrigger = !open ? (
    <button
      onClick={toggle}
      onPointerEnter={prefetchAskSurface}
      onFocus={prefetchAskSurface}
      title="Ask CAOS (Alt+K, or via the ⌘K palette) — cross-issuer query, or issuer Q&A in Deep-Dive / Model"
      aria-label="Ask CAOS phone utility"
      className="caos-ask-phone-trigger fixed z-overlay items-center gap-1.5 tabular text-caos-md px-2.5 py-1.5 rounded-full border border-caos-accent/60 bg-caos-panel text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
      style={{ boxShadow: "var(--shadow-pop)" }}
    >
      <AskMark /> Ask
      <span className="tabular text-caos-2xs px-1 rounded border border-caos-border">Alt+K</span>
    </button>
  ) : null;

  if (scope === "deepdive" || !open) return phoneTrigger;
  return <AskOpenSurface pathname={pathname} onClose={() => setOpen(false)} />;
}

/** Breakpoint-owned shell trigger. Overlay ownership stays in AskLauncher. */
export function AskUtility() {
  const { open, toggle } = useAsk();
  const { user, needsLogin } = useAuth();
  const pathname = usePathname() || "";
  if (!user || needsLogin || pathname.startsWith("/query")) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      onPointerEnter={prefetchAskSurface}
      onFocus={prefetchAskSurface}
      aria-label="Ask CAOS utility"
      aria-expanded={open}
      title="Ask CAOS (Alt+K, or via the ⌘K palette)"
      className="caos-ask-utility flex min-h-8 items-center gap-1.5 rounded border border-caos-border px-2 tabular text-caos-xs text-caos-muted transition-caos hover:border-caos-accent/60 hover:text-caos-text focus-ring"
    >
      <AskMark small />
      <span>Ask</span>
      <span className="ml-auto tabular text-caos-2xs text-caos-muted">Alt+K</span>
    </button>
  );
}

function AskMark({ small = false }: { small?: boolean }) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span className={`${size} shrink-0 rounded-sm border border-caos-accent/70 bg-caos-accent/15 text-caos-accent flex items-center justify-center`} aria-hidden="true">
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 stroke-current" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 6h8M6 2v8" />
      </svg>
    </span>
  );
}
