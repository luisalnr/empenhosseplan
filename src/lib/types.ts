export interface Ref {
  codigo: string;
  descricao: string;
}

export interface Empenho {
  numero: string;
  exercicio: string; // ano do sufixo do número (7130010001/2026 → "2026")
  dataEmissao: string; // ISO yyyy-mm-dd
  motivo: string;
  tipo: string; // Ordinário | Estimativo | Global
  descricao: string; // descrição longa do empenho
  reduzido: string;
  despesa: string; // código 10 dígitos
  categoria: Ref;
  gnd: Ref;
  modalidade: Ref;
  elemento: Ref;
  fonte: Ref;
  credor: string;
  classe: Ref; // classe de credor (WW)
  valor: number; // empenhado
  anulado: number;
  complemento: number;
  liquidado: number;
  pago: number;
  aLiquidar: number;
}

export interface MtoTable {
  [codigo: string]: string;
}

export interface MtoData {
  elemento: MtoTable;
  fonte: MtoTable;
  categoria: MtoTable;
  gnd: MtoTable;
  modalidade: MtoTable;
  classe: MtoTable;
}

export interface Totais {
  empenhado: number;
  anulado: number;
  liquido: number;
  liquidado: number;
  pago: number;
  aLiquidar: number;
  qtdEmpenhos: number;
  qtdCredores: number;
  pctExecucao: number; // liquidado / liquido
  pctPago: number; // pago / liquidado
}

export interface Filtros {
  /** Seleção única: o painel sempre analisa um exercício por vez. */
  exercicio: string;
  credor: string[];
  elemento: string[];
  fonte: string[];
  classe: string[];
  tipo: string[];
  dataInicio: string;
  dataFim: string;
}

export type Pagina = "sintese" | "risco" | "resumo" | "empenhos" | "importacao" | "usuarios";

/** Período de análise declarado no topo dos relatórios WW (emissão / liquidação / pagamento). */
export interface PeriodoAnalise {
  inicio: string; // ISO yyyy-mm-dd
  fim: string; // ISO yyyy-mm-dd
}

export interface FaseDespesa {
  numero: string;
  data: string; // ISO yyyy-mm-dd
  numeroEmpenho: string;
  status: string;
  valor: number;
}

export type TipoImportacao = "empenho" | "liquidacao" | "pagamento";

export interface ResultadoImportacao {
  tipo: TipoImportacao;
  ok: boolean;
  registros: number;
  erros: string[];
  avisos: string[];
}

export type StatusChecagem = "ok" | "aviso" | "erro" | "pendente";

export interface Checagem {
  id: string;
  label: string;
  status: StatusChecagem;
  detalhe?: string;
  count?: number;
  /** Amostra dos registros envolvidos (nºs de empenho), para o drill-down da UI. */
  itens?: string[];
}

export interface RiscoEmpenho {
  numero: string;
  credor: string;
  dataEmissao: string;
  tipo: string;
  descricao: string;
  elemento: { codigo: string; descricao: string };
  fonte: { codigo: string; descricao: string };
  liquido: number;     // valor - anulado
  liquidado: number;
  aLiquidar: number;   // não processado (empenhado não liquidado)
  pago: number;
  aPagar: number;      // processado (liquidado não pago)
  tipoRisco: "np" | "p" | null; // np: empenhado não liquidado | p: liquidado não pago
}

export interface RiscoAgregado {
  valorRNP: number;      // soma aLiquidar dos empenhos com aLiquidar > 0
  valorRP: number;       // soma aPagar dos empenhos com aPagar > 0
  qtdNP: number;          // empenhos com aLiquidar > 0
  qtdP: number;            // empenhos com aPagar > 0
  qtdEmRisco: number;      // empenhos em risco (NP ou P)
  qtdCredoresRisco: number; // credores distintos com empenhos em risco
  pctRNP: number;          // valorRNP / empenhadoLiquido
  pctRP: number;           // valorRP / liquidado
}
