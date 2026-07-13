import { pgTable, text, date, numeric, index, primaryKey } from "drizzle-orm/pg-core";

/**
 * Tabela `empenhos` — refs aninhadas (categoria, gnd, modalidade, elemento,
 * fonte, classe) achetadas em pares de colunas (codigo + descricao).
 * Colunas monetárias usam numeric(14,2) para preservar precisão decimal.
 */
export const empenhos = pgTable(
  "empenhos",
  {
    numero: text("numero").notNull(),
    dataEmissao: date("data_emissao").notNull(),
    motivo: text("motivo").notNull().default(""),
    tipo: text("tipo").notNull().default(""),
    descricao: text("descricao").notNull().default(""),
    reduzido: text("reduzido").notNull().default(""),
    despesa: text("despesa").notNull().default(""),
    credor: text("credor").notNull().default(""),

    // categoria
    categoriaCodigo: text("categoria_codigo").notNull().default(""),
    categoriaDescricao: text("categoria_descricao").notNull().default(""),
    // gnd
    gndCodigo: text("gnd_codigo").notNull().default(""),
    gndDescricao: text("gnd_descricao").notNull().default(""),
    // modalidade
    modalidadeCodigo: text("modalidade_codigo").notNull().default(""),
    modalidadeDescricao: text("modalidade_descricao").notNull().default(""),
    // elemento
    elementoCodigo: text("elemento_codigo").notNull().default(""),
    elementoDescricao: text("elemento_descricao").notNull().default(""),
    // fonte
    fonteCodigo: text("fonte_codigo").notNull().default(""),
    fonteDescricao: text("fonte_descricao").notNull().default(""),
    // classe credor
    classeCodigo: text("classe_codigo").notNull().default(""),
    classeDescricao: text("classe_descricao").notNull().default(""),

    // valores monetários
    valor: numeric("valor", { precision: 14, scale: 2 }).notNull().default("0"),
    anulado: numeric("anulado", { precision: 14, scale: 2 }).notNull().default("0"),
    complemento: numeric("complemento", { precision: 14, scale: 2 }).notNull().default("0"),
    liquidado: numeric("liquidado", { precision: 14, scale: 2 }).notNull().default("0"),
    pago: numeric("pago", { precision: 14, scale: 2 }).notNull().default("0"),
    aLiquidar: numeric("a_liquidar", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.numero] }),
    credorIdx: index("idx_empenhos_credor").on(t.credor),
    dataIdx: index("idx_empenhos_data").on(t.dataEmissao),
    tipoIdx: index("idx_empenhos_tipo").on(t.tipo),
    elementoIdx: index("idx_empenhos_elemento").on(t.elementoCodigo),
    fonteIdx: index("idx_empenhos_fonte").on(t.fonteCodigo),
    classeIdx: index("idx_empenhos_classe").on(t.classeCodigo),
  })
);

export type EmpenhoRow = typeof empenhos.$inferSelect;
export type EmpenhoInsert = typeof empenhos.$inferInsert;

/**
 * Tabelas de fases da despesa (liquidações e pagamentos).
 * PK = numero do documento da fase.
 */
export const liquidacoes = pgTable(
  "liquidacoes",
  {
    numero: text("numero").notNull(),
    data: date("data"),
    numeroEmpenho: text("numero_empenho").notNull().default(""),
    status: text("status").notNull().default(""),
    valor: numeric("valor", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.numero] }),
    empenhoIdx: index("idx_liquidacoes_empenho").on(t.numeroEmpenho),
    dataIdx: index("idx_liquidacoes_data").on(t.data),
  })
);

export const pagamentos = pgTable(
  "pagamentos",
  {
    numero: text("numero").notNull(),
    data: date("data"),
    numeroEmpenho: text("numero_empenho").notNull().default(""),
    status: text("status").notNull().default(""),
    valor: numeric("valor", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.numero] }),
    empenhoIdx: index("idx_pagamentos_empenho").on(t.numeroEmpenho),
    dataIdx: index("idx_pagamentos_data").on(t.data),
  })
);

export type LiquidacaoRow = typeof liquidacoes.$inferSelect;
export type LiquidacaoInsert = typeof liquidacoes.$inferInsert;
export type PagamentoRow = typeof pagamentos.$inferSelect;
export type PagamentoInsert = typeof pagamentos.$inferInsert;
