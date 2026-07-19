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
const ALT_ACTION_EVENTS: Partial<Record<string, string>> = {
  KeyS: "caos:command-palette-open",
  KeyC: "caos:collapse-toggle",
};

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

function openHelp(event: KeyboardEvent): void {
  if (event.key !== "?" || event.metaKey || event.ctrlKey) return;
  event.preventDefault();
  window.dispatchEvent(new Event("caos:help-open"));
}

function dispatchAltAction(event: KeyboardEvent, path: string | null): boolean {
  const eventName = ALT_ACTION_EVENTS[event.code];
  if (eventName) {
    event.preventDefault();
    window.dispatchEvent(new Event(eventName));
    return true;
  }
  if (event.code !== "KeyK") return false;
  event.preventDefault();
  window.dispatchEvent(new Event(path?.startsWith("/query") ? "caos:query-focus" : "caos:ask-toggle"));
  return true;
}

function subviewDirection(event: KeyboardEvent): -1 | 1 | null {
  if (event.key === "." || event.code === "Period") return 1;
  if (event.key === "," || event.code === "Comma") return -1;
  return null;
}

function dispatchSubviewCycle(event: KeyboardEvent): boolean {
  const direction = subviewDirection(event);
  if (direction === null) return false;
  event.preventDefault();
  window.dispatchEvent(new CustomEvent("caos:subview-cycle", { detail: { direction } }));
  return true;
}

function conceptDestination(key: string, path: string | null): string | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const direction = key === "ArrowRight" ? 1 : -1;
  const current = CONCEPTS.findIndex((concept) => path === concept || path?.startsWith(concept + "/"));
  const start = direction === 1 ? 0 : CONCEPTS.length - 1;
  const next = current === -1 ? start : (current + direction + CONCEPTS.length) % CONCEPTS.length;
  return CONCEPTS[next];
}

function handleHotkey(event: KeyboardEvent, path: string | null, navigate: (destination: string) => void): void {
  if (isEditable(event.target)) return;
  if (!event.altKey) {
    openHelp(event);
    return;
  }
  if (dispatchAltAction(event, path) || dispatchSubviewCycle(event)) return;
  const destination = conceptDestination(event.key, path);
  if (!destination) return;
  event.preventDefault();
  navigate(destination);
}

export function ConceptHotkeys() {
  const router = useRouter();
  const attemptNavigation = useNavigationAttempt();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Match letter chords on e.code: macOS Option resolves e.key to composed
      // characters (Alt+S → "ß", Alt+K → "˚", Alt+C → "ç").
      handleHotkey(e, pathRef.current, (destination) => {
        attemptNavigation(() => router.push(destination));
      });
    };
    window.addEventListener("keydown", down);
    return () => {
      window.removeEventListener("keydown", down);
    };
  }, [attemptNavigation, router]);

  return null;
}
