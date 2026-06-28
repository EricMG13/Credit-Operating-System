"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; title: string; body?: string };
const Ctx = createContext<(title: string, body?: string) => void>(() => {});

export function useNotify() {
  return useContext(Ctx);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const notify = useCallback((title: string, body?: string) => {
    const id = Date.now();
    setItems((v) => [...v.slice(-2), { id, title, body }]);
    window.setTimeout(() => setItems((v) => v.filter((x) => x.id !== id)), 5200);
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-14 right-3 z-toast flex w-[320px] max-w-[calc(100vw-24px)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="rounded border border-caos-accent/50 bg-caos-panel px-3 py-2 shadow-lg">
            <div className="tabular text-caos-sm font-medium text-caos-text">{t.title}</div>
            {t.body ? <div className="mt-0.5 tabular text-caos-xs text-caos-muted">{t.body}</div> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
