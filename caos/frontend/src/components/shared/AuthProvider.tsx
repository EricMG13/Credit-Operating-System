"use client";

// Identity context. Authentication itself is platform-managed (Databricks
// Apps workspace OAuth at the edge) — this provider just resolves who the
// signed-in user is via /api/auth/me. There is no login flow in the app.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: false,
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = async () => {
    try {
      setUser(await getMe());
      setError(false);
    } catch {
      setUser(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
