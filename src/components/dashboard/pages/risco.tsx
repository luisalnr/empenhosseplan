"use client";
import * as React from "react";
import { AlertTriangle, Clock, FileWarning } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { exerciciosDe } from "@/lib/exercicio";
import { ChartCard } from "../chart-card";
import { KpiCard } from "../kpi-card";
import { RiscoCredores } from "../charts/risco-credores";
import { calcularRiscos, agregarRisco } from "@/lib/risco";
import { formatCurrency, formatPercent, formatDate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RiscoEmpenho } from "@/lib/types";

const TIPO_RISCO_LABEL: Record<NonNullable<RiscoEmpenho["tipoRisco"]>, string> = {
  np: "Não Processado",
  p: "Processado",
};
const TIPO_RISCO_CLS: Record<NonNullable<RiscoEmpenho["tipoRisco"]>, string> = {
  np: "bg-orange-300/25 text-orange-600 dark:text-orange-300",
  p: "bg-yellow-300/25 text-yellow-700 dark:text-yellow-300",
};

const PAGE_SIZE = 12;

type SortKey = "tipoRisco" | "dataEmissao" | "credor" | "liquido" | "liquidado" | "aLiquidar" | "aPagar";
const COLS: { key: SortKey; label: string; numeric?: boolean; class?: string }[] = [
  { key: "tipoRisco", label: "Tipo de Risco" },
  { key: "dataEmissao", label: "Emissão" },
  { key: "credor", label: "Credor", class: "min-w-[200px]" },
  { key: "liquido", label: "Empenhado Líquido", numeric: true },
  { key: "liquidado", label: "Liquidado", numeric: true },
  { key: "aLiquidar", label: "A Liquidar (NP)", numeric: true },
  { key: "aPagar", label: "A Pagar (P)", numeric: true },
];

type FiltroTipoRisco = "todos" | "np" | "p";

export function RiscoPage() {
  const { filtered } = useDashboard();
  const riscos = React.useMemo(() => calcularRiscos(filtered), [filtered]);
  const agg = React.useMemo(() => agregarRisco(riscos), [riscos]);
  // Lido do resultado filtrado, não do filtro: "nenhum exercício marcado" = todos.
  const exerciciosSelecionados = React.useMemo(() => exerciciosDe(filtered), [filtered]);

  const [filtroTipo, setFiltroTipo] = React.useState<FiltroTipoRisco>("todos");

  const emRisco = React.useMemo(() => {
    const base = riscos.filter((r) => r.tipoRisco !== null);
    if (filtroTipo === "todos") return base;
    return base.filter((r) => r.tipoRisco === filtroTipo);
  }, [riscos, filtroTipo]);

  // Tabela: ordenável, ordenação padrão por A Liquidar desc
  const [sortKey, setSortKey] = React.useState<SortKey>("aLiquidar");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(0);

  const ordenados = React.useMemo(() => {
    const arr = [...emRisco];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "tipoRisco") { va = a.tipoRisco ?? ""; vb = b.tipoRisco ?? ""; }
      else if (sortKey === "dataEmissao" || sortKey === "credor") { va = a[sortKey]; vb = b[sortKey]; }
      else { va = a[sortKey]; vb = b[sortKey]; }
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc" ? String(va).localeCompare(String(vb), "pt-BR") : String(vb).localeCompare(String(va), "pt-BR");
    });
    return arr;
  }, [emRisco, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages - 1);
  const pageRows = ordenados.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE);

  React.useEffect(() => setPage(0), [filtered, filtroTipo]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toneRNP = agg.pctRNP >= 0.3 ? "destructive" : agg.pctRNP > 0 ? "warning" : "success";
  const toneRP = agg.pctRP >= 0.1 ? "destructive" : agg.pctRP > 0 ? "warning" : "success";

  return (
    <div className="space-y-3">
      {exerciciosSelecionados.length > 1 && (
        <Card className="flex items-start gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Indicadores somando os exercícios {exerciciosSelecionados.join(", ")}. O saldo do
            exercício corrente e os restos a pagar de anos anteriores estão no mesmo número —
            selecione um único exercício para uma leitura contábil válida.
          </span>
        </Card>
      )}

      {/* KPIs de risco — RNP e RP separados */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <KpiCard
          label="Risco Não Processado"
          value={formatCurrency(agg.valorRNP)}
          icon={FileWarning}
          tone={toneRNP}
          hint={`${agg.qtdNP.toLocaleString("pt-BR")} empenhos não liquidados`}
          progress={agg.pctRNP}
          progressDynamic
          progressLabel={`${formatPercent(agg.pctRNP, 2)} do empenhado líquido`}
          progressInfo="% RNP = A Liquidar ÷ Empenhado Líquido. Proporção do orçamento empenhado que ainda não foi liquidada e pode virar restos a pagar não processados."
          info="Risco Não Processado (RAP-NP): soma de A Liquidar (Empenhado Líquido − Liquidado) dos empenhos emitidos mas ainda não liquidados. Se não liquidados até 31/12, viram restos a pagar não processados no exercício seguinte."
        />
        <KpiCard
          label="Risco Processado"
          value={formatCurrency(agg.valorRP)}
          icon={Clock}
          tone={toneRP}
          hint={`${agg.qtdP.toLocaleString("pt-BR")} empenhos não pagos`}
          progress={agg.pctRP}
          progressDynamic
          progressLabel={`${formatPercent(agg.pctRP, 2)} do liquidado`}
          progressInfo="% RP = A Pagar ÷ Liquidado. Proporção do valor já liquidado que ainda não foi paga e pode virar restos a pagar processados."
          info="Risco Processado (RAP-P): soma de A Pagar (Liquidado − Pago) dos empenhos já liquidados mas ainda não pagos. Se não pagos até 31/12, viram restos a pagar processados no exercício seguinte."
        />
      </div>

      {/* Bar chart: top credores por valor em risco (respeita filtro de tipo) */}
      <ChartCard
        title="Top 10 credores por valor em risco"
        subtitle={
          filtroTipo === "np"
            ? "Filtrado: Não Processado (A Liquidar)"
            : filtroTipo === "p"
              ? "Filtrado: Processado (A Pagar)"
              : "Empilhado: A Liquidar (NP) + A Pagar (P)"
        }
        className="h-[360px]"
      >
        <RiscoCredores riscos={emRisco} />
      </ChartCard>

      {/* Tabela de empenhos em risco */}
      <Card className="flex flex-col">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Empenhos em risco de restos a pagar
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {emRisco.length.toLocaleString("pt-BR")} empenho
              {emRisco.length === 1 ? "" : "s"}
              {filtroTipo === "todos"
                ? " com saldo a liquidar e/ou a pagar"
                : filtroTipo === "np"
                  ? " não processado(s) (a liquidar)"
                  : " processado(s) (a pagar)"}
            </p>
          </div>
          <div
            className="flex shrink-0 rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Filtrar por tipo de risco"
          >
            {(
              [
                { id: "todos", label: "Todos" },
                { id: "np", label: "Não processado" },
                { id: "p", label: "Processado" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFiltroTipo(opt.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  filtroTipo === opt.id
                    ? opt.id === "np"
                      ? "bg-orange-300/30 text-orange-700 dark:text-orange-300"
                      : opt.id === "p"
                        ? "bg-yellow-300/30 text-yellow-800 dark:text-yellow-300"
                        : "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLS.map((c) => (
                    <TableHead key={c.key} className={cn(c.numeric && "text-right", c.class)}>
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {c.label}
                        {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS.length} className="h-32 text-center text-muted-foreground">
                      Nenhum empenho em risco para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.numero}>
                      <TableCell>
                        {r.tipoRisco && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TIPO_RISCO_CLS[r.tipoRisco]}`}>
                            {TIPO_RISCO_LABEL[r.tipoRisco]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.dataEmissao)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.credor}>{r.credor}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.liquido)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.liquidado)}</TableCell>
                      <TableCell className="text-right tabular-nums text-orange-400 dark:text-orange-300">{formatCurrency(r.aLiquidar)}</TableCell>
                      <TableCell className="text-right tabular-nums text-yellow-500 dark:text-yellow-300">{formatCurrency(r.aPagar)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border p-3">
          <span className="text-xs text-muted-foreground">Página {curPage + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={curPage === 0}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={curPage >= totalPages - 1}
            >
              Próxima
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
