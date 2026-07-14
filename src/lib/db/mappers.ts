import type { Empenho, FaseDespesa } from "../types";
import { exercicioDe } from "../exercicio";
import type {
  EmpenhoRow,
  EmpenhoInsert,
  LiquidacaoRow,
  LiquidacaoInsert,
  PagamentoRow,
} from "./schema";

/** Converte linha do Postgres (Drizzle) em objeto Empenho (refs reconstituídas). */
export function rowToEmpenho(r: EmpenhoRow): Empenho {
  const dataEmissao = r.dataEmissao ? String(r.dataEmissao).slice(0, 10) : "";
  return {
    numero: r.numero,
    exercicio: r.exercicio || exercicioDe(r.numero, dataEmissao),
    dataEmissao,
    motivo: r.motivo,
    tipo: r.tipo,
    descricao: r.descricao,
    reduzido: r.reduzido,
    despesa: r.despesa,
    credor: r.credor,
    categoria: { codigo: r.categoriaCodigo, descricao: r.categoriaDescricao },
    gnd: { codigo: r.gndCodigo, descricao: r.gndDescricao },
    modalidade: { codigo: r.modalidadeCodigo, descricao: r.modalidadeDescricao },
    elemento: { codigo: r.elementoCodigo, descricao: r.elementoDescricao },
    fonte: { codigo: r.fonteCodigo, descricao: r.fonteDescricao },
    classe: { codigo: r.classeCodigo, descricao: r.classeDescricao },
    valor: num(r.valor),
    anulado: num(r.anulado),
    complemento: num(r.complemento),
    liquidado: num(r.liquidado),
    pago: num(r.pago),
    aLiquidar: num(r.aLiquidar),
  };
}

/** Converte objeto Empenho em payload para insert Drizzle (refs achatadas). */
export function empenhoToInsert(e: Empenho): EmpenhoInsert {
  return {
    numero: e.numero,
    exercicio: e.exercicio || exercicioDe(e.numero, e.dataEmissao),
    dataEmissao: e.dataEmissao,
    motivo: e.motivo ?? "",
    tipo: e.tipo ?? "",
    descricao: e.descricao ?? "",
    reduzido: e.reduzido ?? "",
    despesa: e.despesa ?? "",
    credor: e.credor ?? "",
    categoriaCodigo: e.categoria.codigo ?? "",
    categoriaDescricao: e.categoria.descricao ?? "",
    gndCodigo: e.gnd.codigo ?? "",
    gndDescricao: e.gnd.descricao ?? "",
    modalidadeCodigo: e.modalidade.codigo ?? "",
    modalidadeDescricao: e.modalidade.descricao ?? "",
    elementoCodigo: e.elemento.codigo ?? "",
    elementoDescricao: e.elemento.descricao ?? "",
    fonteCodigo: e.fonte.codigo ?? "",
    fonteDescricao: e.fonte.descricao ?? "",
    classeCodigo: e.classe.codigo ?? "",
    classeDescricao: e.classe.descricao ?? "",
    valor: String(e.valor ?? 0),
    anulado: String(e.anulado ?? 0),
    complemento: String(e.complemento ?? 0),
    liquidado: String(e.liquidado ?? 0),
    pago: String(e.pago ?? 0),
    aLiquidar: String(e.aLiquidar ?? 0),
  };
}

function num(v: string | number | null): number {
  if (v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Converte lista de Empenho para lista de inserts (atalho). */
export function empenhosToInserts(list: Empenho[]): EmpenhoInsert[] {
  return list.map(empenhoToInsert);
}

export function rowToFase(r: LiquidacaoRow | PagamentoRow): FaseDespesa {
  return {
    numero: r.numero,
    data: r.data ? String(r.data).slice(0, 10) : "",
    numeroEmpenho: r.numeroEmpenho ?? "",
    status: r.status ?? "",
    valor: num(r.valor),
  };
}

export function faseToInsert(f: FaseDespesa): LiquidacaoInsert {
  return {
    numero: f.numero || `${f.numeroEmpenho}-${f.data}-${f.valor}`,
    data: f.data || null,
    numeroEmpenho: f.numeroEmpenho ?? "",
    status: f.status ?? "",
    valor: String(f.valor ?? 0),
  };
}

export function fasesToInserts(list: FaseDespesa[]): LiquidacaoInsert[] {
  return list.map(faseToInsert);
}
