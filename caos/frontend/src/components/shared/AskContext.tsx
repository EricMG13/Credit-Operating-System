"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { hasOpenModalA11yOverlay } from "@/lib/use-modal-a11y";

interface AskCtx {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
  /** Open Ask with optional prefilled text from the command palette. */
  openWith: (prefill?: string) => void;
  /** One-shot prefill consumed by the Ask modal on open. */
  prefill: string | null;
}

const AskContext = createContext<AskCtx>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  openWith: () => {},
  prefill: null,
});

export const useAsk = () => useContext(AskContext);

export function AskProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const pathname = usePathname() || "";
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const openWith = useCallback((text?: string) => {
    if (pathRef.current.startsWith("/query")) {
      window.dispatchEvent(new CustomEvent("caos:query-focus", { detail: { text } }));
      return;
    }
    window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
    setPrefill(text ?? null);
    setOpen(true);
  }, []);

  useEffect(() => {
    const fire = () => {
      if (pathname.startsWith("/query")) {
        window.dispatchEvent(new Event("caos:query-focus"));
      } else {
        if (!open) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
        setOpen(!open);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !hasOpenModalA11yOverlay()) setOpen(false);
    };
    const onAskToggle = () => fire();
    const onModalOpen = (event: Event) => {
      if ((event as CustomEvent<{ owner?: string }>).detail?.owner !== "ask") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("caos:ask-toggle", onAskToggle);
    window.addEventListener("caos:modal-open", onModalOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("caos:ask-toggle", onAskToggle);
      window.removeEventListener("caos:modal-open", onModalOpen);
    };
  }, [pathname, open]);

  useEffect(() => {
    if (!open) setPrefill(null);
  }, [open]);

  const setOpenCoordinated = useCallback((next: boolean) => {
    if (next) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
    setOpen(next);
  }, []);

  const toggle = useCallback(() => {
    if (!open) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
    setOpen(!open);
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen: setOpenCoordinated, toggle, openWith, prefill }),
    [open, setOpenCoordinated, toggle, openWith, prefill],
  );
  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}
