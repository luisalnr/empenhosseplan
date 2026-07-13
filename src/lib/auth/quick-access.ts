/**
 * Cache de acesso rápido no navegador (localStorage), válido por 7 dias
 * quando o usuário autoriza no login.
 *
 * Inclui e-mail, perfil e senha (solicitado para acesso rápido).
 * A autenticação de API continua no cookie httpOnly assinado.
 *
 * Aviso: armazenar senha em localStorage é conveniente, mas qualquer
 * script no domínio consegue ler. Use apenas em ambiente controlado.
 */

export interface CachedAuthUser {
  id: string;
  name: string;
  email: string;
  papel: string;
}

export interface QuickAccessCache {
  version: 2;
  authorized: true;
  /** timestamp ms em que o cache expira (login + 7 dias) */
  expiresAt: number;
  savedAt: number;
  email: string;
  /** senha em base64 (ofuscação simples, não é criptografia forte) */
  passwordB64: string;
  user: CachedAuthUser;
}

export const QUICK_ACCESS_KEY = "seplan_quick_access_v1";
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function encodePassword(password: string): string {
  try {
    return btoa(unescape(encodeURIComponent(password)));
  } catch {
    return "";
  }
}

function decodePassword(b64: string): string {
  if (!b64) return "";
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return "";
  }
}

export function isCacheValid(
  cache: QuickAccessCache | null | undefined
): cache is QuickAccessCache {
  if (!cache || !cache.authorized) return false;
  if (Number(cache.version) < 1) return false;
  if (!cache.email || !cache.user?.email) return false;
  if (!cache.expiresAt || cache.expiresAt <= now()) return false;
  return true;
}

/** Migra cache v1 (sem senha) se ainda existir. */
function normalizeCache(raw: unknown): QuickAccessCache | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<QuickAccessCache> & { version?: number };
  if (!c.email || !c.user) return null;
  return {
    version: 2,
    authorized: true,
    expiresAt: Number(c.expiresAt) || 0,
    savedAt: Number(c.savedAt) || now(),
    email: String(c.email),
    passwordB64: String(c.passwordB64 || ""),
    user: {
      id: String(c.user.id || ""),
      name: String(c.user.name || ""),
      email: String(c.user.email || c.email),
      papel: String(c.user.papel || ""),
    },
  };
}

export function loadQuickAccess(): QuickAccessCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUICK_ACCESS_KEY);
    if (!raw) return null;
    const parsed = normalizeCache(JSON.parse(raw));
    if (!isCacheValid(parsed)) {
      localStorage.removeItem(QUICK_ACCESS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Salva acesso rápido por 7 dias (inclui senha). */
export function saveQuickAccess(
  user: CachedAuthUser,
  password: string
): QuickAccessCache {
  const cache: QuickAccessCache = {
    version: 2,
    authorized: true,
    savedAt: now(),
    expiresAt: now() + SEVEN_DAYS_MS,
    email: user.email,
    passwordB64: encodePassword(password),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      papel: user.papel,
    },
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(cache));
  }
  return cache;
}

/** Atualiza o user no cache sem resetar o prazo; preserva a senha salva. */
export function updateQuickAccessUser(
  user: CachedAuthUser
): QuickAccessCache | null {
  const existing = loadQuickAccess();
  if (!existing) return null;
  const next: QuickAccessCache = {
    ...existing,
    version: 2,
    email: user.email,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      papel: user.papel,
    },
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(next));
  }
  return next;
}

/**
 * Remove o cache.
 * - keepCredentials: mantém e-mail + senha (sem sessão de perfil) por 7 dias
 * - keepEmail: só e-mail (legado)
 */
export function clearQuickAccess(opts?: {
  keepEmail?: boolean;
  keepCredentials?: boolean;
}) {
  if (typeof window === "undefined") return;
  let email = "";
  let passwordB64 = "";
  try {
    const raw = localStorage.getItem(QUICK_ACCESS_KEY);
    if (raw) {
      const p = normalizeCache(JSON.parse(raw));
      email = p?.email || "";
      passwordB64 = p?.passwordB64 || "";
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(QUICK_ACCESS_KEY);

  if (opts?.keepCredentials && email) {
    const shell: QuickAccessCache = {
      version: 2,
      authorized: true,
      savedAt: now(),
      expiresAt: now() + SEVEN_DAYS_MS,
      email,
      passwordB64,
      user: { id: "", name: "", email, papel: "" },
    };
    localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(shell));
    return;
  }

  if (opts?.keepEmail && email) {
    const shell: QuickAccessCache = {
      version: 2,
      authorized: true,
      savedAt: now(),
      expiresAt: now() + SEVEN_DAYS_MS,
      email,
      passwordB64: "",
      user: { id: "", name: "", email, papel: "" },
    };
    localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(shell));
  }
}

export function getCachedEmail(): string {
  return loadQuickAccess()?.email || "";
}

export function getCachedPassword(): string {
  const c = loadQuickAccess();
  if (!c?.passwordB64) return "";
  return decodePassword(c.passwordB64);
}

export function hasQuickAccessAuth(): boolean {
  const c = loadQuickAccess();
  return Boolean(c?.authorized && c.user?.id);
}

export function daysLeftInQuickAccess(): number | null {
  const c = loadQuickAccess();
  if (!c) return null;
  const ms = c.expiresAt - now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
