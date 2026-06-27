"use client";

// Identity context. Network access is governed at the edge proxy; on top of that
// the analyst self-registers a named profile via the code-gated login (see
// LoginLanding). This provider resolves the active identity via /api/auth/me:
// `source === "profile"` means a profile is signed in; anything else (proxy SSO,
// local dev, or a 401) means the login landing should show. A network/API error
// is kept distinct so RequireAuth shows "can't reach API", not the login form.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { getMe } from "@/lib/api";

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

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  // fallow-ignore-next-line complexity
  const refresh = async () => {
    try {
      const me: AuthUser = await getMe();
      setUser(me);
      setError(false);
      // "local" only happens off-proxy in a non-deployed run (deployed → 401 or
      // "proxy", never "local"), so accept it as signed-in: preview never gates
      // on login. "proxy" (SSO) still self-registers a named profile.
      setNeedsLogin(me.source !== "profile" && me.source !== "local");
    } catch (e) {
      setUser(null);
      // 401 = no identity yet → show the login landing. Anything else = API down.
      const unauthorized = axios.isAxiosError(e) && e.response?.status === 401;
      setNeedsLogin(unauthorized);
      setError(!unauthorized);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, needsLogin, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
