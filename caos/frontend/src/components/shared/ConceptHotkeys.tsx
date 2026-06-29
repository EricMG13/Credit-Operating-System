"use client";

// Global shortcuts: hold ALT and press ←/→ to cycle concepts; S focuses issuer
// search; K opens Ask; C broadcasts collapse/open panes. Mounted once in the root
// layout. Inactive while typing in inputs/textareas/contenteditables.

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const CONCEPTS = ["/command", "/pipeline", "/deepdive", "/model", "/reports", "/monitor", "/research", "/query"];

function isEditable(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return (
    n.tagName === "INPUT" ||
    n.tagName === "TEXTAREA" ||
    n.tagName === "SELECT" ||
    n.isContentEditable
  );
}

export function ConceptHotkeys() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (isEditable(e.target)) return;

      if (["s", "S", "k", "K", "c", "C"].includes(e.key)) {
        e.preventDefault();
        if (e.key.toLowerCase() === "s") window.dispatchEvent(new Event("caos:issuer-search-focus"));
        if (e.key.toLowerCase() === "k") window.dispatchEvent(new Event("caos:ask-toggle"));
        if (e.key.toLowerCase() === "c") window.dispatchEvent(new Event("caos:collapse-toggle"));
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const cur = CONCEPTS.findIndex((c) => (pathRef.current || "").startsWith(c));
      const next =
        cur === -1
          ? dir === 1
            ? 0
            : CONCEPTS.length - 1
          : (cur + dir + CONCEPTS.length) % CONCEPTS.length;
      router.push(CONCEPTS[next]);
    };
    window.addEventListener("keydown", down);
    return () => {
      window.removeEventListener("keydown", down);
    };
  }, [router]);

  return null;
}
