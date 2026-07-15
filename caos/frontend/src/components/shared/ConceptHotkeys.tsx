"use client";

// Global shortcuts: hold ALT and press ←/→ to cycle concepts; S opens the unified
// command palette; K opens Ask; C broadcasts collapse/open panes. Mounted once in the root
// layout. Inactive while typing in inputs/textareas/contenteditables.

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CONCEPT_CYCLE } from "@/lib/nav";
import { useNavigationAttempt } from "./NavigationGuardProvider";

// Alt+←/→ stops come from the shared nav registry — cycle order is the visual
// nav order by construction (this file used to keep its own diverging list).
const CONCEPTS = CONCEPT_CYCLE;

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
  const attemptNavigation = useNavigationAttempt();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (isEditable(e.target)) return;

      if (["s", "S", "k", "K", "c", "C"].includes(e.key)) {
        e.preventDefault();
        if (e.key.toLowerCase() === "s") window.dispatchEvent(new Event("caos:command-palette-open"));
        if (e.key.toLowerCase() === "k") {
          if (pathRef.current?.startsWith("/query")) {
            window.dispatchEvent(new Event("caos:query-focus"));
          } else {
            window.dispatchEvent(new Event("caos:ask-toggle"));
          }
        }
        if (e.key.toLowerCase() === "c") window.dispatchEvent(new Event("caos:collapse-toggle"));
        return;
      }
      if (e.key === "," || e.key === "." || e.code === "Comma" || e.code === "Period") {
        e.preventDefault();
        const dir = (e.key === "." || e.code === "Period") ? 1 : -1;
        window.dispatchEvent(new CustomEvent("caos:subview-cycle", { detail: { direction: dir } }));
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const path = pathRef.current || "";
      const cur = CONCEPTS.findIndex((c) => path === c || path.startsWith(c + "/"));
      const next =
        cur === -1
          ? dir === 1
            ? 0
            : CONCEPTS.length - 1
          : (cur + dir + CONCEPTS.length) % CONCEPTS.length;
      attemptNavigation(() => router.push(CONCEPTS[next]));
    };
    window.addEventListener("keydown", down);
    return () => {
      window.removeEventListener("keydown", down);
    };
  }, [attemptNavigation, router]);

  return null;
}
