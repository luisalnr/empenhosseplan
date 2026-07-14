import type { FaseDespesa } from "../types";
import { exercicioDe, exerciciosDosVinculos } from "../exercicio";
import { usandoNeon } from "./repository";

/**
 * Repositório de fases (liquidações/pagamentos) — dual-mode, igual ao repository.ts.
 * - NEXT_PUBLIC_USE_NEON=true → API routes (Neon Postgres)
 * - ausente → Dexie/IndexedDB (modo demo)
 * JSONs estáticos em /public/data continuam como fallback via seedFasesIfEmpty().
 */

// ───────────────────────── Backend: Neon (via API routes) ─────────────────────────

async function apiGetFases(path: string): Promise<FaseDespesa[]> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status} em ${path}`);
  }
  return res.json() as Promise<FaseDespesa[]>;
}

async function apiPostFases(
  path: string,
  records: FaseDespesa[],
  mode: "merge" | "replace" = "replace"
): Promise<number> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status} em ${path}`);
  }
  const r = await res.json();
  return r.inserted ?? records.length;
}

async function apiDeleteFases(path: string): Promise<void> {
  await fetch(path, { method: "DELETE" });
}

const neonFasesRepo = {
  async getLiquidacoes(): Promise<FaseDespesa[]> {
    return apiGetFases("/api/fases/liquidacoes");
  },
  async getPagamentos(): Promise<FaseDespesa[]> {
    return apiGetFases("/api/fases/pagamentos");
  },
  async saveLiquidacoes(records: FaseDespesa[], mode: "merge" | "replace" = "replace"): Promise<number> {
    return apiPostFases("/api/fases/liquidacoes", records, mode);
  },
  async savePagamentos(records: FaseDespesa[], mode: "merge" | "replace" = "replace"): Promise<number> {
    return apiPostFases("/api/fases/pagamentos", records, mode);
  },
  async clearLiquidacoes(): Promise<void> {
    await apiDeleteFases("/api/fases/liquidacoes");
  },
  async clearPagamentos(): Promise<void> {
    await apiDeleteFases("/api/fases/pagamentos");
  },
  async countLiquidacoes(): Promise<number> {
    const r = await apiGetFases("/api/fases/liquidacoes");
    return r.length;
  },
  async countPagamentos(): Promise<number> {
    const r = await apiGetFases("/api/fases/pagamentos");
    return r.length;
  },
};

// ───────────────────────── Backend: IndexedDB (Dexie) ─────────────────────────

async function getDexie() {
  const { getDB } = await import("./db");
  return getDB();
}

const dexieFasesRepo = {
  async getLiquidacoes(): Promise<FaseDespesa[]> {
    const db = await getDexie();
    return db.liquidacoes.toArray();
  },
  async getPagamentos(): Promise<FaseDespesa[]> {
    const db = await getDexie();
    return db.pagamentos.toArray();
  },
  async saveLiquidacoes(records: FaseDespesa[], mode: "merge" | "replace" = "replace"): Promise<number> {
    if (!records.length && mode !== "replace") return 0;
    const db = await getDexie();
    if (mode === "replace") {
      const exercicios = exerciciosDosVinculos(records);
      await db.transaction("rw", db.liquidacoes, async () => {
        if (exercicios.length) {
          await db.liquidacoes
            .toCollection()
            .filter((f) => exercicios.includes(exercicioDe(f.numeroEmpenho)))
            .delete();
        }
        if (records.length) await db.liquidacoes.bulkPut(records);
      });
    } else if (records.length) {
      await db.liquidacoes.bulkPut(records);
    }
    return records.length;
  },
  async savePagamentos(records: FaseDespesa[], mode: "merge" | "replace" = "replace"): Promise<number> {
    if (!records.length && mode !== "replace") return 0;
    const db = await getDexie();
    if (mode === "replace") {
      const exercicios = exerciciosDosVinculos(records);
      await db.transaction("rw", db.pagamentos, async () => {
        if (exercicios.length) {
          await db.pagamentos
            .toCollection()
            .filter((f) => exercicios.includes(exercicioDe(f.numeroEmpenho)))
            .delete();
        }
        if (records.length) await db.pagamentos.bulkPut(records);
      });
    } else if (records.length) {
      await db.pagamentos.bulkPut(records);
    }
    return records.length;
  },
  async clearLiquidacoes(): Promise<void> {
    const db = await getDexie();
    await db.liquidacoes.clear();
  },
  async clearPagamentos(): Promise<void> {
    const db = await getDexie();
    await db.pagamentos.clear();
  },
  async countLiquidacoes(): Promise<number> {
    const db = await getDexie();
    return db.liquidacoes.count();
  },
  async countPagamentos(): Promise<number> {
    const db = await getDexie();
    return db.pagamentos.count();
  },
};

// ───────────────────────── Interface pública ─────────────────────────

// Mesma resolução em runtime do repository.ts: `usandoNeon()` pergunta ao servidor
// (/api/health) quando a flag de build não está ligada, evitando cair no IndexedDB
// sem aviso num deploy mal configurado.
let backendPromise: Promise<typeof neonFasesRepo | typeof dexieFasesRepo> | null = null;

function getBackend() {
  if (!backendPromise) {
    backendPromise = usandoNeon().then((neon) => (neon ? neonFasesRepo : dexieFasesRepo));
  }
  return backendPromise;
}

export const getLiquidacoes = async () => (await getBackend()).getLiquidacoes();
export const getPagamentos = async () => (await getBackend()).getPagamentos();
export const saveLiquidacoes = async (r: FaseDespesa[], mode: "merge" | "replace" = "replace") =>
  (await getBackend()).saveLiquidacoes(r, mode);
export const savePagamentos = async (r: FaseDespesa[], mode: "merge" | "replace" = "replace") =>
  (await getBackend()).savePagamentos(r, mode);
export const clearLiquidacoes = async () => (await getBackend()).clearLiquidacoes();
export const clearPagamentos = async () => (await getBackend()).clearPagamentos();
export const countLiquidacoes = async () => (await getBackend()).countLiquidacoes();
export const countPagamentos = async () => (await getBackend()).countPagamentos();

/**
 * Carrega JSON estático de fallback se o repositório estiver vazio.
 * Retorna os registros carregados (ou [] se já havia dados).
 */
export async function seedFasesIfEmpty(): Promise<{ liquidacoes: FaseDespesa[]; pagamentos: FaseDespesa[] }> {
  const [nLiq, nPag] = await Promise.all([countLiquidacoes(), countPagamentos()]);
  if (nLiq > 0 && nPag > 0) {
    return { liquidacoes: [], pagamentos: [] };
  }
  const [resLiq, resPag] = await Promise.all([
    fetch("/data/liquidacoes.json"),
    fetch("/data/pagamentos.json"),
  ]);
  const liq = resLiq.ok ? ((await resLiq.json()) as FaseDespesa[]) : [];
  const pag = resPag.ok ? ((await resPag.json()) as FaseDespesa[]) : [];
  if (nLiq === 0 && liq.length) await saveLiquidacoes(liq);
  if (nPag === 0 && pag.length) await savePagamentos(pag);
  return { liquidacoes: liq, pagamentos: pag };
}
