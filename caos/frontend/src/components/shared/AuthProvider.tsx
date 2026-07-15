"use client";

// Identity context. Network access is governed at the edge proxy; on top of that
// the analyst self-registers a named profile via the code-gated login (see
// LoginLanding). This provider resolves the active identity via /api/auth/me:
// `source === "profile"` means a profile is signed in; anything else (proxy SSO,
// local dev, or a 401) means the login landing should show. A network/API error
// is kept distinct so RequireAuth shows "can't reach API", not the login form.

import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import {
  PRINCIPAL_STORAGE_KEY,
  bindWorkspacePrincipal,
  clearWorkspaceStorage,
  getMe,
} from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  source: string; // "profile" | "proxy" | "local"
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: boolean; // API unreachable (not "needs login")
  needsLogin: boolean; // resolved, but no analyst profile yet
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: false,
  needsLogin: false,
  refresh: async () => {},
});

const LOGIN_BYPASS_USER: AuthUser = {
  id: "local-dev",
  email: "analyst@local.dev",
  full_name: "Local Analyst",
  role: "analyst",
  is_active: true,
  source: "local",
};

function loginBypassEnabled() {
  // ponytail: temporary local-preview bypass; remove when login testing resumes.
  return process.env.NODE_ENV === "development"
    || (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN === "1");
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const refreshGeneration = useRef(0);
  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  // fallow-ignore-next-line complexity
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    if (loginBypassEnabled()) {
      bindWorkspacePrincipal(LOGIN_BYPASS_USER.id);
      if (generation !== refreshGeneration.current) return;
      setUser(LOGIN_BYPASS_USER);
      setError(false);
      setNeedsLogin(false);
      setLoading(false);
      return;
    }

    try {
      const me: AuthUser = await getMe();
      if (generation !== refreshGeneration.current) return;
      bindWorkspacePrincipal(me.id);
      setUser(me);
      setError(false);
      // "local" only happens off-proxy in a non-deployed run (deployed → 401 or
      // "proxy", never "local"), so accept it as signed-in: preview never gates
      // on login. "proxy" (SSO) still self-registers a named profile.
      setNeedsLogin(me.source !== "profile" && me.source !== "local");
    } catch (e) {
      if (generation !== refreshGeneration.current) return;
      setUser(null);
      // 401 = no identity yet → show the login landing. Anything else = API down.
      const unauthorized = axios.isAxiosError(e) && e.response?.status === 401;
      if (unauthorized) clearWorkspaceStorage();
      setNeedsLogin(unauthorized);
      setError(!unauthorized);
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // SEAM4-1: identity is resolved once at mount, so a session lost mid-session is
  // otherwise invisible. Re-resolve when (a) any request reports a 401 — the
  // api.ts interceptor fires `caos:auth-lost`, covering the off-proxy cookie-loss
  // 401 storm that had no re-login route; and (b) the tab regains focus — which
  // catches the silent SSO principal swap where get_identity falls through from a
  // revoked profile cookie to the proxy identity (200s keep flowing under a
  // different id, so only a re-check of /me surfaces it).
  useEffect(() => {
    const onLost = () => { refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PRINCIPAL_STORAGE_KEY) return;
      if (event.newValue === userRef.current?.id) return;
      clearWorkspaceStorage();
      refresh();
    };
    window.addEventListener("caos:auth-lost", onLost);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("caos:auth-lost", onLost);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, needsLogin, refresh }}>
      <Fragment key={user?.id ?? (needsLogin ? "needs-login" : "anonymous")}>{children}</Fragment>
    </AuthContext.Provider>
  );
}
