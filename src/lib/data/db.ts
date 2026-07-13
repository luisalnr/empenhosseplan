import Dexie, { type Table } from "dexie";
import type { Empenho, FaseDespesa } from "../types";

class SeplanDB extends Dexie {
  empenhos!: Table<Empenho, string>;
  liquidacoes!: Table<FaseDespesa, string>;
  pagamentos!: Table<FaseDespesa, string>;

  constructor() {
    // Nome versionado: trocas da planilha-base (seed) exigem um DB novo para
    // recarregar os dados atualizados em navegadores já com o seed anterior.
    super("seplan_empenhos_v7");
    this.version(1).stores({
      // PK = numero; índices nos campos de filtro/agrupamento mais usados
      empenhos: "numero, dataEmissao, credor, tipo, elemento.codigo, fonte.codigo, classe.codigo, gnd.codigo, categoria.codigo",
      liquidacoes: "numero, numeroEmpenho, data",
      pagamentos: "numero, numeroEmpenho, data",
    });
  }
}

let dbInstance: SeplanDB | null = null;

export function getDB(): SeplanDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB não disponível no servidor");
  }
  if (!dbInstance) dbInstance = new SeplanDB();
  return dbInstance;
}
