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
    // Replace escopado aos exercícios do arquivo: reimportar 2026 não pode apagar 2025.
    const exercicios = [...new Set(records.map((r) => r.exercicio).filter(Boolean))];
    await db.transaction("rw", db.empenhos, async () => {
      if (exercicios.length) {
        await db.empenhos.where("exercicio").anyOf(exercicios).delete();
      }
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

/**
 * Escolha do backend, resolvida em RUNTIME.
 *
 * `NEXT_PUBLIC_USE_NEON` é embutida no bundle durante o build. Um deploy sem ela
 * (ex.: variável não configurada no Vercel) fazia o app cair no IndexedDB sem aviso:
 * a importação "funcionava" na tela, mas nada chegava ao Postgres. Por isso, quando a
 * flag não está ligada, perguntamos ao servidor se ele tem banco (`/api/health`) antes
 * de assumir o modo demo.
 */
let backendPromise: Promise<typeof neonRepo | typeof dexieRepo> | null = null;

async function servidorTemBanco(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return false;
    const { neon } = (await res.json()) as { neon?: boolean };
    return Boolean(neon);
  } catch {
    return false;
  }
}

function getBackend() {
  if (!backendPromise) {
    backendPromise = USE_NEON
      ? Promise.resolve(neonRepo)
      : servidorTemBanco().then((temBanco) => (temBanco ? neonRepo : dexieRepo));
  }
  return backendPromise;
}

/** True quando as gravações vão para o Postgres; false = modo demo (só neste navegador). */
export const usandoNeon = async (): Promise<boolean> => (await getBackend()) === neonRepo;

export const getAllEmpenhos = async () => (await getBackend()).getAll();
export const countEmpenhos = async () => (await getBackend()).count();
export const upsertEmpenhos = async (r: Empenho[]) => (await getBackend()).upsert(r);
export const replaceAllEmpenhos = async (r: Empenho[]) => (await getBackend()).replaceAll(r);
export const clearEmpenhos = async () => (await getBackend()).clear();
export const seedIfEmpty = async () => (await getBackend()).seedIfEmpty();
