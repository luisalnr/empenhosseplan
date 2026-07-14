import type { Empenho, PeriodoAnalise } from "./types";
import { formatDate } from "./utils";

/** exercício ("2026") → período declarado no relatório daquele exercício. */
export type PeriodosPorExercicio = Record<string, PeriodoAnalise>;

const EPOCH_MS = Date.UTC(1899, 11, 30);
const STORAGE_KEY = "seplan_periodo_analise";

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const s = value.trim();
    // ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // dd/mm/yyyy
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) {
      const d = br[1].padStart(2, "0");
      const m = br[2].padStart(2, "0");
      return `${br[3]}-${m}-${d}`;
    }
  }
  const n = Number(value);
  // serial Excel (≈ anos 1982–2064)
  if (Number.isFinite(n) && n > 30_000 && n < 60_000) {
    return new Date(EPOCH_MS + n * 86_400_000).toISOString().slice(0, 10);
  }
  return "";
}

/**
 * Extrai o período do cabeçalho dos relatórios WW.
 * Layout típico (linha 2): [rótulo com "Período"] [data início] ["até"] [data fim]
 */
export function extractPeriodoFromRows(rows: unknown[][]): PeriodoAnalise | null {
  if (!Array.isArray(rows)) return null;
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    for (let j = 0; j < row.length; j++) {
      const cell = str(row[j]).toLowerCase();
      if (cell !== "até" && cell !== "ate") continue;
      const inicio = toIsoDate(row[j - 1]);
      const fim = toIsoDate(row[j + 1]);
      if (inicio && fim) return { inicio, fim };
    }
    // fallback: linha com "período" e duas datas na mesma linha
    const hasPeriodo = row.some(
      (c) =>
        str(c).toLowerCase().includes("período") ||
        str(c).toLowerCase().includes("periodo")
    );
    if (!hasPeriodo) continue;
    const datas: string[] = [];
    for (const c of row) {
      const iso = toIsoDate(c);
      if (iso) datas.push(iso);
    }
    if (datas.length >= 2) return { inicio: datas[0], fim: datas[1] };
  }
  return null;
}

/**
 * Período declarado no relatório que originou o seed (public/data/seed-periodo.json,
 * gerado por scripts/build-data.py). Usado quando os dados vieram do seed e não de
 * uma importação — nesse caso não há planilha em mãos para extrair o cabeçalho.
 */
export async function loadPeriodoSeed(): Promise<PeriodoAnalise | null> {
  try {
    const res = await fetch("/data/seed-periodo.json");
    if (!res.ok) return null;
    const p = (await res.json()) as PeriodoAnalise | null;
    return p?.inicio && p?.fim ? p : null;
  } catch {
    return null;
  }
}

/** Último recurso: min/max das datas de emissão dos empenhos carregados. */
export function periodoFromEmpenhos(empenhos: Empenho[]): PeriodoAnalise | null {
  const datas = empenhos.map((e) => e.dataEmissao).filter(Boolean).sort();
  if (!datas.length) return null;
  return { inicio: datas[0], fim: datas[datas.length - 1] };
}

/** Um período por exercício, derivado das emissões (fallback de quem não declarou). */
export function periodosFromEmpenhos(empenhos: Empenho[]): PeriodosPorExercicio {
  const out: PeriodosPorExercicio = {};
  for (const ex of new Set(empenhos.map((e) => e.exercicio).filter(Boolean))) {
    const p = periodoFromEmpenhos(empenhos.filter((e) => e.exercicio === ex));
    if (p) out[ex] = p;
  }
  return out;
}

/** Intervalo que cobre os exercícios pedidos (ou todos, se a lista vier vazia). */
export function periodoDosExercicios(
  mapa: PeriodosPorExercicio,
  exercicios: string[]
): PeriodoAnalise | null {
  const alvos = exercicios.length ? exercicios : Object.keys(mapa);
  const ps = alvos.map((ex) => mapa[ex]).filter(Boolean);
  if (!ps.length) return null;
  return {
    inicio: ps.map((p) => p.inicio).sort()[0],
    fim: ps.map((p) => p.fim).sort().reverse()[0],
  };
}

export function formatPeriodo(p: PeriodoAnalise | null | undefined): string {
  if (!p?.inicio || !p?.fim) return "";
  return `${formatDate(p.inicio)} a ${formatDate(p.fim)}`;
}

/**
 * Mapa exercício → período, persistido no localStorage. O formato antigo era um
 * único período (pré-multiexercício); se for o que estiver salvo, migra atribuindo-o
 * ao exercício da data de início.
 */
export function loadPeriodosStored(): PeriodosPorExercicio {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PeriodoAnalise | PeriodosPorExercicio;
    if (isPeriodo(parsed)) {
      const ex = parsed.inicio.slice(0, 4);
      return ex ? { [ex]: parsed } : {};
    }
    return Object.fromEntries(
      Object.entries(parsed ?? {}).filter(([, p]) => isPeriodo(p))
    );
  } catch {
    return {};
  }
}

/** Grava o período de um exercício, preservando os demais. */
export function savePeriodoStored(exercicio: string, p: PeriodoAnalise | null): void {
  if (typeof window === "undefined" || !exercicio) return;
  try {
    const mapa = loadPeriodosStored();
    if (p) mapa[exercicio] = p;
    else delete mapa[exercicio];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    /* ignore */
  }
}

function isPeriodo(v: unknown): v is PeriodoAnalise {
  const p = v as PeriodoAnalise | null;
  return !!p && typeof p.inicio === "string" && typeof p.fim === "string" && !!p.inicio && !!p.fim;
}
