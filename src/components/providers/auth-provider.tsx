"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "seplan_auth_session";
const PERSIST_KEY = "seplan_auth_session_persist";
const REMEMBER_PREF_KEY = "seplan_remember_7d_pref";
const REMEMBER_EMAIL_KEY = "seplan_remember_email";

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
  /** Preferência de “manter acesso 7 dias” (para pré-marcar o checkbox). */
  rememberPref: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
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
    const raw =
      localStorage.getItem(PERSIST_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.email) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSession(user: AuthUser | null, persist: boolean) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
    return;
  }
  const raw = JSON.stringify(user);
  if (persist) {
    localStorage.setItem(PERSIST_KEY, raw);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(REMEMBER_PREF_KEY, "1");
    localStorage.setItem(REMEMBER_EMAIL_KEY, user.email);
  } else {
    sessionStorage.setItem(STORAGE_KEY, raw);
    localStorage.removeItem(PERSIST_KEY);
    localStorage.removeItem(REMEMBER_PREF_KEY);
    // mantém e-mail opcional só se já havia preferência — senão limpa
  }
}

export function getRememberPref(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REMEMBER_PREF_KEY) === "1";
}

export function getRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rememberPref, setRememberPref] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        writeSession(null, false);
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
      const persist = getRememberPref();
      writeSession(session, persist);
      setUser(session);
      setRememberPref(persist);
    } catch {
      setUser(readSession());
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setRememberPref(getRememberPref());
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
    async (email: string, password: string, remember = false) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
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
      writeSession(session, remember);
      setRememberPref(remember);
      if (remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, session.email);
      }
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
    // Mantém preferência de e-mail se havia remember; limpa sessão
    const emailKeep = getRememberedEmail();
    const hadPref = getRememberPref();
    writeSession(null, false);
    if (hadPref && emailKeep) {
      localStorage.setItem(REMEMBER_PREF_KEY, "1");
      localStorage.setItem(REMEMBER_EMAIL_KEY, emailKeep);
    }
    setUser(null);
    router.replace("/login");
  }, [router]);

  const isAdmin = user?.papel === "admin";

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, rememberPref, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
