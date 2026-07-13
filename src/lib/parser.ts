import type { Empenho, MtoData, PeriodoAnalise, Ref } from "./types";
import { derivarClassificacoes, lookupFonte, lookupClasse } from "./mto";
import { extractPeriodoFromRows } from "./periodo";

const EPOCH_MS = Date.UTC(1899, 11, 30);

function serialToIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(EPOCH_MS + n * 86_400_000).toISOString().slice(0, 10);
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function findHeader(rows: unknown[][]): { idx: number; map: Record<string, number> } | null {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => str(c).toLowerCase());
    const hasCredor = cells.some((c) => c.includes("credor"));
    const hasValor = cells.some((c) => c.includes("valor"));
    if (hasCredor && hasValor) {
      const map: Record<string, number> = {};
      rows[i].forEach((c, j) => {
        const key = str(c).toLowerCase();
        if (key) map[key] = j;
      });
      return { idx: i, map };
    }
  }
  return null;
}

function colFor(map: Record<string, number>, ...keys: string[]): number {
  for (const k of keys) {
    // match exato primeiro (evita pegar "motivo da despesa" ao buscar "despesa")
    for (const hk of Object.keys(map)) {
      if (hk === k) return map[hk];
    }
    // depois substring
    for (const hk of Object.keys(map)) {
      if (hk.includes(k)) return map[hk];
    }
  }
  return -1;
}

/** Colunas esperadas no relatório de empenhos WW/SICAF. */
export const COLUNAS_EMPENHO = [
  "Nº Empenho",
  "Data Emissão",
  "Motivo da Despesa",
  "Tipo",
  "Descrição",
  "Reduzido",
  "Despesa",
  "Fonte",
  "Credor",
  "Classe",
  "Valor (R$)",
  "Anulado (R$)",
  "Complemento (R$)",
  "Liquidado (R$)",
  "Pago (R$)",
  "A Liquidar (R$)",
];

export interface ParseResult {
  records: Empenho[];
  totalLinhas: number;
  colunasEncontradas: Record<string, boolean>;
  periodo: PeriodoAnalise | null;
}

export async function parseSicafXlsx(file: Blob, mto: MtoData): Promise<ParseResult> {
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const rows = (await readXlsxFile(file)) as unknown as unknown[][];
  const periodo = extractPeriodoFromRows(rows);

  const header = findHeader(rows);
  if (!header) {
    throw new Error(
      "Cabeçalho não encontrado. Verifique se a planilha segue o layout SICAF/WW (colunas Credor, Valor, etc.)."
    );
  }

  const c = {
    num: colFor(header.map, "nº empenho", "nº", "n ", "numero", "empenho"),
    data: colFor(header.map, "data emiss", "data"),
    motivo: colFor(header.map, "motivo"),
    tipo: colFor(header.map, "tipo"),
    desc: colFor(header.map, "descri"),
    red: colFor(header.map, "reduzido"),
    desp: colFor(header.map, "despesa"),
    fonte: colFor(header.map, "fonte"),
    cred: colFor(header.map, "credor"),
    classe: colFor(header.map, "classe"),
    val: colFor(header.map, "valor"),
    anul: colFor(header.map, "anul"),
    compl: colFor(header.map, "complemento"),
    liq: colFor(header.map, "liquidado"),
    pago: colFor(header.map, "pago"),
    aliq: colFor(header.map, "a liquid", "liquidar"),
  };

  const colunasEncontradas: Record<string, boolean> = {
    "Nº Empenho": c.num >= 0,
    "Data Emissão": c.data >= 0,
    "Motivo da Despesa": c.motivo >= 0,
    Tipo: c.tipo >= 0,
    Descrição: c.desc >= 0,
    Reduzido: c.red >= 0,
    Despesa: c.desp >= 0,
    Fonte: c.fonte >= 0,
    Credor: c.cred >= 0,
    Classe: c.classe >= 0,
    "Valor (R$)": c.val >= 0,
    "Anulado (R$)": c.anul >= 0,
    "Complemento (R$)": c.compl >= 0,
    "Liquidado (R$)": c.liq >= 0,
    "Pago (R$)": c.pago >= 0,
    "A Liquidar (R$)": c.aliq >= 0,
  };

  const records: Empenho[] = [];
  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const num = str(row[c.num]);
    if (!num) continue;
    const desp = str(row[c.desp]);
    const fonteRaw = str(row[c.fonte]);
    const cls = derivarClassificacoes(desp, mto);
    const fonte: Ref = lookupFonte(fonteRaw, mto);
    const classe: Ref = lookupClasse(str(row[c.classe]), mto);
    const valor = toNum(row[c.val]);
    const anulado = toNum(row[c.anul]);
    const complemento = c.compl >= 0 ? toNum(row[c.compl]) : 0;
    const liquidado = toNum(row[c.liq]);
    const pago = toNum(row[c.pago]);
    const aLiquidar =
      c.aliq >= 0 ? toNum(row[c.aliq]) : Math.max(0, valor - anulado - liquidado);
    records.push({
      numero: num,
      dataEmissao: serialToIso(row[c.data]),
      motivo: str(row[c.motivo]),
      tipo: str(row[c.tipo]),
      descricao: str(row[c.desc]),
      reduzido: str(row[c.red]),
      despesa: desp,
      categoria: cls.categoria,
      gnd: cls.gnd,
      modalidade: cls.modalidade,
      elemento: cls.elemento,
      fonte,
      credor: str(row[c.cred]),
      classe,
      valor,
      anulado,
      complemento,
      liquidado,
      pago,
      aLiquidar,
    });
  }

  return { records, totalLinhas: records.length, colunasEncontradas, periodo };
}
