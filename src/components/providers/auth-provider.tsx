"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  clearQuickAccess,
  getCachedEmail,
  getCachedPassword,
  loadQuickAccess,
  saveQuickAccess,
  updateQuickAccessUser,
} from "@/lib/auth/quick-access";

const SESSION_KEY = "seplan_auth_session";

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
  /** Usuário autorizou acesso rápido (cache 7 dias) nesta máquina. */
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

/** E-mail salvo no cache de acesso rápido. */
export function getRememberedEmail(): string {
  return getCachedEmail();
}

/** Senha salva no cache de acesso rápido (se autorizada). */
export function getRememberedPassword(): string {
  return getCachedPassword();
}

function readEphemeralSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.email) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeEphemeralSession(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (!user) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function readAnyLocalUser(): AuthUser | null {
  const qa = loadQuickAccess();
  if (qa?.user?.id) {
    return {
      id: qa.user.id,
      name: qa.user.name,
      email: qa.user.email,
      papel: qa.user.papel,
    };
  }
  return readEphemeralSession();
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
        const keepCreds = Boolean(loadQuickAccess()?.authorized);
        writeEphemeralSession(null);
        clearQuickAccess({ keepCredentials: keepCreds });
        setUser(null);
        setRememberPref(Boolean(getCachedEmail()));
        return;
      }
      const data = await res.json();
      const session: AuthUser = {
        id: data.id || "",
        name: data.name || "Usuário",
        email: data.email || "",
        papel: data.papel || "operador",
      };

      const qa = loadQuickAccess();
      if (qa?.authorized) {
        // Mantém senha e prazo; atualiza perfil. Se não havia user id, regrava com senha salva.
        const updated = updateQuickAccessUser(session);
        if (!updated) {
          const pwd = getCachedPassword();
          if (pwd) saveQuickAccess(session, pwd);
        }
        writeEphemeralSession(null);
        setRememberPref(true);
      } else {
        writeEphemeralSession(session);
        setRememberPref(false);
      }
      setUser(session);
    } catch {
      setUser(readAnyLocalUser());
      setRememberPref(Boolean(loadQuickAccess()?.authorized));
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      const qa = loadQuickAccess();
      setRememberPref(Boolean(qa?.authorized));
      setUser(readAnyLocalUser());
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

      if (remember) {
        saveQuickAccess(session, password);
        writeEphemeralSession(null);
        setRememberPref(true);
      } else {
        clearQuickAccess();
        writeEphemeralSession(session);
        setRememberPref(false);
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
    writeEphemeralSession(null);
    // Mantém e-mail e senha no cache se havia acesso rápido
    clearQuickAccess({ keepCredentials: true });
    setUser(null);
    setRememberPref(Boolean(getCachedEmail()));
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
