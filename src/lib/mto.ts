import type { MtoData, MtoTable, Ref } from "./types";

async function fetchTable(name: string): Promise<MtoTable> {
  const res = await fetch(`/data/mto/${name}.json`);
  if (!res.ok) throw new Error(`Falha ao carregar ${name}`);
  const arr: { codigo: string; descricao: string }[] = await res.json();
  const map: MtoTable = {};
  for (const item of arr) {
    map[item.codigo] = item.descricao;
    if (item.codigo.length === 1) map[item.codigo.padStart(2, "0")] = item.descricao;
  }
  return map;
}

let cache: MtoData | null = null;
let pending: Promise<MtoData> | null = null;

export async function loadMto(): Promise<MtoData> {
  if (cache) return cache;
  if (pending) return pending;
  pending = (async () => {
    const [elemento, fonte, categoria, gnd, modalidade, classe] = await Promise.all([
      fetchTable("elemento-despesa"),
      fetchTable("fonte"),
      fetchTable("categoria-economica"),
      fetchTable("gnd"),
      fetchTable("modalidade-aplicacao"),
      fetchTable("classes-credor"),
    ]);
    cache = { elemento, fonte, categoria, gnd, modalidade, classe };
    return cache;
  })();
  return pending;
}

function lookup(table: MtoTable, codigo: string): Ref {
  const c = (codigo || "").trim();
  if (!c) return { codigo: "", descricao: "" };
  const descricao = table[c] ?? table[c.padStart(2, "0")] ?? "";
  return { codigo: c, descricao };
}

/**
 * Deriva as classificações orçamentárias (MTO) do código de Despesa de 10 dígitos.
 * Estrutura: [0]Categoria [1]GND [2-3]Modalidade [4-5]Elemento [6-9]Item/Subitem
 */
export function derivarClassificacoes(despesa: string, mto: MtoData) {
  const d = despesa || "";
  return {
    categoria: lookup(mto.categoria, d.slice(0, 1)),
    gnd: lookup(mto.gnd, d.slice(1, 2)),
    modalidade: lookup(mto.modalidade, d.slice(2, 4)),
    elemento: lookup(mto.elemento, d.slice(4, 6)),
  };
}

export function lookupFonte(fonteRaw: string, mto: MtoData): Ref {
  const raw = (fonteRaw || "").trim();
  let codigo = raw;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) codigo = String(Math.round(n));
  }
  return lookup(mto.fonte, codigo);
}

export function lookupClasse(classeRaw: string, mto: MtoData): Ref {
  const raw = (classeRaw || "").trim();
  let codigo = raw;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) codigo = String(Math.round(n));
  }
  return lookup(mto.classe, codigo);
}
