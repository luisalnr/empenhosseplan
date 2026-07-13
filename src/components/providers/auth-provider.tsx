"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "seplan_auth_session";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  papel: "admin" | "operador" | string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

function readSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.email) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSession(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (!user) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        writeSession(null);
        setUser(null);
        return;
      }
      const data = await res.json();
      const session: AuthUser = {
        id: data.id || "",
        name: data.name || "Usuário",
        email: data.email || "",
        papel: data.papel || "operador",
      };
      writeSession(session);
      setUser(session);
    } catch {
      // se /me falhar, mantém cache local se existir
      setUser(readSession());
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setUser(readSession());
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  React.useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    } else if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Falha ao autenticar");
      }
      const session: AuthUser = {
        id: data.id || "",
        name: data.name || "Usuário SEPLAN",
        email: data.email || email,
        papel: data.papel || "operador",
      };
      writeSession(session);
      setUser(session);
      router.replace("/");
    },
    [router]
  );

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    writeSession(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const isAdmin = user?.papel === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
