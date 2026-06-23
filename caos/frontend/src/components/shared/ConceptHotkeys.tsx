"use client";

// Global concept-switch shortcut: hold SPACE and press ←/→ to cycle through
// the seven concept views (wraps at the ends). Mounted once in the root
// layout. Inactive while typing in inputs/textareas/contenteditables so the
// spacebar still types spaces there.

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
  const spaceHeld = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (!isEditable(e.target)) spaceHeld.current = true;
        return;
      }
      if (!spaceHeld.current) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isEditable(e.target)) return;
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
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeld.current = false;
    };
    const clear = () => {
      spaceHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [router]);

  return null;
}
