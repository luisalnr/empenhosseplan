import type { Empenho } from "../types";

/**
 * Flag: se NEXT_PUBLIC_USE_NEON === "true", o cliente usa API routes que falam
 * com Neon Postgres no servidor. Caso contrário, usa IndexedDB local (modo demo).
 * Em produção (Vercel), defina NEXT_PUBLIC_USE_NEON=true e DATABASE_URL no servidor.
 */
const USE_NEON = process.env.NEXT_PUBLIC_USE_NEON === "true";

// ───────────────────────── Backend: Neon (via API routes) ─────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status} em ${path}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status} em ${path}`);
  }
  return res.json() as Promise<T>;
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status} em ${path}`);
  }
  return res.json() as Promise<T>;
}

const neonRepo = {
  async getAll(): Promise<Empenho[]> {
    return apiGet<Empenho[]>("/api/empenhos");
  },
  async count(): Promise<number> {
    const r = await apiGet<{ count: number }>("/api/empenhos/count");
    return r.count;
  },
  async upsert(records: Empenho[]): Promise<number> {
    if (!records.length) return 0;
    const r = await apiPost<{ inserted: number }>("/api/empenhos", {
      mode: "merge",
      records,
    });
    return r.inserted;
  },
  async replaceAll(records: Empenho[]): Promise<number> {
    const r = await apiPost<{ inserted: number }>("/api/empenhos", {
      mode: "replace",
      records,
    });
    return r.inserted;
  },
  async clear(): Promise<void> {
    await apiDelete("/api/empenhos");
  },
  async seedIfEmpty(): Promise<boolean> {
    const n = await this.count();
    if (n > 0) return false;
    const res = await fetch("/data/seed-empenhos.json");
    if (!res.ok) throw new Error("Não foi possível carregar o seed de demonstração");
    const records: Empenho[] = await res.json();
    await this.upsert(records);
    return true;
  },
};

// ───────────────────────── Backend: IndexedDB (Dexie) ─────────────────────────

async function getDexie() {
  const { getDB } = await import("./db");
  return getDB();
}

const dexieRepo = {
  async getAll(): Promise<Empenho[]> {
    const db = await getDexie();
    return db.empenhos.toArray();
  },
  async count(): Promise<number> {
    const db = await getDexie();
    return db.empenhos.count();
  },
  async upsert(records: Empenho[]): Promise<number> {
    if (!records.length) return 0;
    const db = await getDexie();
    await db.empenhos.bulkPut(records);
    return records.length;
  },
  async replaceAll(records: Empenho[]): Promise<number> {
    const db = await getDexie();
    await db.transaction("rw", db.empenhos, async () => {
      await db.empenhos.clear();
      if (records.length) await db.empenhos.bulkPut(records);
    });
    return records.length;
  },
  async clear(): Promise<void> {
    const db = await getDexie();
    await db.empenhos.clear();
  },
  async seedIfEmpty(): Promise<boolean> {
    const db = await getDexie();
    const n = await db.empenhos.count();
    if (n > 0) return false;
    const res = await fetch("/data/seed-empenhos.json");
    if (!res.ok) throw new Error("Não foi possível carregar o seed de demonstração");
    const records: Empenho[] = await res.json();
    await db.empenhos.bulkPut(records);
    return true;
  },
};

// ───────────────────────── Interface pública ─────────────────────────

const backend = USE_NEON ? neonRepo : dexieRepo;

export const getAllEmpenhos = () => backend.getAll();
export const countEmpenhos = () => backend.count();
export const upsertEmpenhos = (r: Empenho[]) => backend.upsert(r);
export const replaceAllEmpenhos = (r: Empenho[]) => backend.replaceAll(r);
export const clearEmpenhos = () => backend.clear();
export const seedIfEmpty = () => backend.seedIfEmpty();

/** Indica se o backend Neon está ativo (útil para debug/UI). */
export const isNeonBackend = USE_NEON;
