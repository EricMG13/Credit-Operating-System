"use client";

// The "?" shortcut reference — a small desk card, not documentation. Opens on
// "?" (ConceptHotkeys) or the caos:help-open event; the list renders from the
// SHORTCUTS registry so it can never document a binding that doesn't exist.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { shortcutsFor, type ShortcutEntry } from "@/lib/shortcuts";

function Row({ entry }: { entry: ShortcutEntry }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-caos-border/40 py-1.5">
      <span className="text-caos-xs text-caos-text">{entry.label}</span>
      <kbd className="tabular shrink-0 rounded-sm border border-caos-border bg-caos-elevated px-1.5 py-0.5 text-caos-2xs text-caos-muted">{entry.keys}</kbd>
    </div>
  );
}

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("caos:help-open", onOpen);
    return () => window.removeEventListener("caos:help-open", onOpen);
  }, []);

  if (!open) return null;
  return <ShortcutHelpDialog pathname={pathname ?? "/"} onClose={() => setOpen(false)} />;
}

function ShortcutHelpDialog({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const { global, route } = shortcutsFor(pathname);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-md border border-caos-border bg-caos-panel p-4 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="caos-action-secondary ml-auto focus-ring" aria-label="Close shortcut reference">Close</button>
        </div>
        <h3 className="mt-3 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Global</h3>
        <div className="mt-1">{global.map((entry) => <Row key={entry.keys + entry.label} entry={entry} />)}</div>
        {route.length ? (
          <>
            <h3 className="mt-4 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{route[0].routeLabel ?? "This page"}</h3>
            <div className="mt-1">{route.map((entry) => <Row key={entry.keys + entry.label} entry={entry} />)}</div>
          </>
        ) : null}
        <p className="mt-3 text-caos-2xs leading-snug text-caos-muted">Press ? anywhere (outside an input) to reopen this reference.</p>
      </div>
    </div>
  );
}
