import type { FaseDespesa } from "./types";
import {
  getLiquidacoes,
  getPagamentos,
  seedFasesIfEmpty,
} from "./data/fases-repository";

let liqCache: FaseDespesa[] | null = null;
let pagCache: FaseDespesa[] | null = null;

/** Invalida o cache em memória (chamar após importação). */
export function invalidateFasesCache() {
  liqCache = null;
  pagCache = null;
}

export async function loadLiquidacoes(): Promise<FaseDespesa[]> {
  if (liqCache) return liqCache;
  await seedFasesIfEmpty();
  liqCache = await getLiquidacoes();
  return liqCache;
}

export async function loadPagamentos(): Promise<FaseDespesa[]> {
  if (pagCache) return pagCache;
  await seedFasesIfEmpty();
  pagCache = await getPagamentos();
  return pagCache;
}

export function indexByEmpenho(fases: FaseDespesa[]): Map<string, FaseDespesa[]> {
  const map = new Map<string, FaseDespesa[]>();
  for (const f of fases) {
    const key = f.numeroEmpenho;
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(f);
  }
  return map;
}
