"use client";

// Role views (Analyst / PM / QA) — a PRESENTATION preference, never
// authorization. Nothing here reads or writes auth state; the server field it
// persists to (AnalystSettings.role_view) is a rendering hint the backend
// never branches on (RT-2026-07-11-61).
//
// Persistence contract: PUT /api/settings/analyst REPLACES the whole settings
// blob, so every save here is a read-modify-write over the latest known blob —
// never a role-only body (it would wipe model_lanes / email_intelligence).
// localStorage gives instant paint before the GET reconciles, and remains the
// only store when the PUT 404s (local-dev bypass identity has no Analyst row).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  getAnalystSettings,
  saveAnalystSettings,
  type AnalystSettings,
  type RoleView,
} from "@/lib/api";

const LS_KEY = "caos_role_view";
const ROLE_VIEWS: RoleView[] = ["analyst", "pm", "qa"];
// Debounce trailing-edge saves so rapid toggling costs one PUT, staying polite
// under the settings route's 30-writes/min limit.
const SAVE_DEBOUNCE_MS = 800;

function coerce(v: unknown): RoleView | null {
  return ROLE_VIEWS.includes(v as RoleView) ? (v as RoleView) : null;
}

const RoleViewContext = createContext<{
  roleView: RoleView;
  setRoleView: (v: RoleView) => void;
  ready: boolean;
}>({ roleView: "analyst", setRoleView: () => {}, ready: false });

export function useRoleView() {
  return useContext(RoleViewContext);
}

export function RoleViewProvider({ children }: { children: React.ReactNode }) {
  const [roleView, setRoleViewState] = useState<RoleView>("analyst");
  const [ready, setReady] = useState(false);
  // Latest server blob, so the debounced save spreads the real sibling maps
  // instead of clobbering them.
  const blobRef = useRef<AnalystSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Server unreachable-for-this-identity (404) — keep localStorage-only.
  const localOnlyRef = useRef(false);

  // Instant paint from localStorage, then reconcile from the server once.
  useEffect(() => {
    const cached = coerce(typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null);
    if (cached) setRoleViewState(cached);
    let cancelled = false;
    getAnalystSettings()
      .then((s) => {
        if (cancelled) return;
        blobRef.current = s;
        const server = coerce(s.role_view);
        // The server value wins over the cache UNLESS the user already toggled
        // this session (a pending save exists) — then the local choice wins.
        if (server && !timerRef.current) {
          setRoleViewState(server);
          window.localStorage.setItem(LS_KEY, server);
        }
      })
      .catch(() => {
        // Offline / unauthenticated: localStorage value already applied.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setRoleView = useCallback((v: RoleView) => {
    setRoleViewState(v);
    try {
      window.localStorage.setItem(LS_KEY, v);
    } catch {
      /* private-mode storage failure — in-memory state still applies */
    }
    if (localOnlyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      try {
        // Read-modify-write: refresh the blob if we never loaded one, then PUT
        // the WHOLE object with only role_view changed.
        const base = blobRef.current ?? (await getAnalystSettings());
        const next = { ...base, role_view: v };
        blobRef.current = await saveAnalystSettings(next);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          // No analyst profile row (local-dev bypass) — localStorage carries it.
          localOnlyRef.current = true;
          return;
        }
        // 429/5xx: optimistic UI + localStorage stand; next toggle retries.
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <RoleViewContext.Provider value={{ roleView, setRoleView, ready }}>
      {children}
    </RoleViewContext.Provider>
  );
}
