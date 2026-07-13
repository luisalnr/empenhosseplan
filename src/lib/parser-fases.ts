import type { FaseDespesa, PeriodoAnalise } from "./types";
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
    const hasEmpenho = cells.some((c) => c.includes("empenho"));
    const hasValor = cells.some((c) => c.includes("valor"));
    if (hasEmpenho && hasValor) {
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
    for (const hk of Object.keys(map)) {
      if (hk === k) return map[hk];
    }
    for (const hk of Object.keys(map)) {
      if (hk.includes(k)) return map[hk];
    }
  }
  return -1;
}

/** Colunas esperadas no relatório de liquidações WW. */
export const COLUNAS_LIQUIDACAO = [
  "Nº Liquidação",
  "Data",
  "Nº Empenho",
  "Status",
  "Valor (R$)",
];

/** Colunas esperadas no relatório de pagamentos WW. */
export const COLUNAS_PAGAMENTO = [
  "Nº Pagamento",
  "Pagamento",
  "Situação",
  "Valor (R$)",
  "Nº Empenho",
];

export interface ParseFaseResult {
  records: FaseDespesa[];
  colunasEncontradas: Record<string, boolean>;
  periodo: PeriodoAnalise | null;
}

/** Parser de liquidações (layout WW: Nº Liquidação, Data, Nº Empenho, Status, Valor). */
export async function parseLiquidacoesXlsx(file: Blob): Promise<ParseFaseResult> {
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const rows = (await readXlsxFile(file)) as unknown as unknown[][];
  const periodo = extractPeriodoFromRows(rows);
  const header = findHeader(rows);
  if (!header) {
    throw new Error("Cabeçalho não encontrado. Verifique se a planilha contém as colunas Nº Empenho e Valor.");
  }

  const c = {
    num: colFor(header.map, "liquida"),
    data: colFor(header.map, "data"),
    emp: colFor(header.map, "nº empenho", "empenho"),
    status: colFor(header.map, "status", "situa"),
    valor: colFor(header.map, "valor"),
  };

  const colunasEncontradas: Record<string, boolean> = {};
  const keys = ["num", "data", "emp", "status", "valor"];
  const labels = ["Nº Liquidação", "Data", "Nº Empenho", "Status", "Valor (R$)"];
  keys.forEach((k, i) => {
    colunasEncontradas[labels[i]] = c[k as keyof typeof c] >= 0;
  });

  const records: FaseDespesa[] = [];
  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const emp = str(row[c.emp]);
    if (!emp) continue;
    records.push({
      numero: str(row[c.num]),
      data: serialToIso(row[c.data]),
      numeroEmpenho: emp,
      status: str(row[c.status]),
      valor: c.valor >= 0 ? toNum(row[c.valor]) : 0,
    });
  }

  return { records, colunasEncontradas, periodo };
}

/** Parser de pagamentos (layout WW: Nº Pagamento, Pagamento [data], Situação, Valor, Nº Empenho). */
export async function parsePagamentosXlsx(file: Blob): Promise<ParseFaseResult> {
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const rows = (await readXlsxFile(file)) as unknown as unknown[][];
  const periodo = extractPeriodoFromRows(rows);
  const header = findHeader(rows);
  if (!header) {
    throw new Error("Cabeçalho não encontrado. Verifique se a planilha contém as colunas Nº Empenho e Valor.");
  }

  const c = {
    num: colFor(header.map, "nº pagamento", "pagamento"),
    data: colFor(header.map, "pagamento"),
    emp: colFor(header.map, "nº empenho", "empenho"),
    status: colFor(header.map, "situa", "status"),
    valor: colFor(header.map, "valor"),
  };

  const colunasEncontradas: Record<string, boolean> = {
    "Nº Pagamento": c.num >= 0,
    Pagamento: c.data >= 0,
    Situação: c.status >= 0,
    "Valor (R$)": c.valor >= 0,
    "Nº Empenho": c.emp >= 0,
  };

  const records: FaseDespesa[] = [];
  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const emp = str(row[c.emp]);
    if (!emp) continue;
    records.push({
      numero: str(row[c.num]),
      data: serialToIso(row[c.data]),
      numeroEmpenho: emp,
      status: str(row[c.status]),
      valor: c.valor >= 0 ? toNum(row[c.valor]) : 0,
    });
  }

  return { records, colunasEncontradas, periodo };
}
