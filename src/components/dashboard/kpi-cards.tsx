"use client";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { KpiCard } from "./kpi-card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  Wallet,
  FileMinus2,
  TrendingDown,
  CheckCircle2,
  Banknote,
  Clock,
} from "lucide-react";

export function KpiCards() {
  const { totais } = useDashboard();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Total Empenhado"
        value={formatCurrency(totais.empenhado)}
        icon={Wallet}
        tone="primary"
        hint={`${totais.qtdEmpenhos.toLocaleString("pt-BR")} empenhos`}
        info="Soma do valor original de todos os empenhos emitidos no período, antes de qualquer anulação."
      />
      <KpiCard
        label="Anulado"
        value={formatCurrency(totais.anulado)}
        icon={FileMinus2}
        tone="destructive"
        hint={formatPercent(totais.empenhado ? totais.anulado / totais.empenhado : 0) + " do empenhado"}
        info="Soma dos valores anulados (cancelados total ou parcialmente) sobre os empenhos emitidos."
      />
      <KpiCard
        label="Empenhado Líquido"
        value={formatCurrency(totais.liquido)}
        icon={TrendingDown}
        tone="default"
        hint="Empenhado − Anulado"
        info="Valor efetivamente disponível para execução: Total Empenhado menos as anulações."
      />
      <KpiCard
        label="Liquidado"
        value={formatCurrency(totais.liquidado)}
        icon={CheckCircle2}
        tone="success"
        progress={totais.pctExecucao}
        progressLabel={`Execução: ${formatPercent(totais.pctExecucao)}`}
        progressInfo="% de Execução = Liquidado ÷ Empenhado Líquido (Total Empenhado − Anulado). Indica quanto do valor disponível já foi liquidado."
        info="Soma dos valores liquidados (direito do credor ao recebimento reconhecido pelo órgão)."
      />
      <KpiCard
        label="Pago"
        value={formatCurrency(totais.pago)}
        icon={Banknote}
        tone="success"
        progress={totais.pctPago}
        progressLabel={`Pago/Liquidado: ${formatPercent(totais.pctPago)}`}
        progressInfo="% Pago = Pago ÷ Liquidado. Indica quanto do valor já liquidado foi efetivamente pago ao credor."
        info="Soma dos valores efetivamente pagos aos credores (ordens bancárias emitidas)."
      />
      <KpiCard
        label="A Liquidar"
        value={formatCurrency(totais.aLiquidar)}
        icon={Clock}
        tone="warning"
        hint="Saldo a executar"
        info="Empenhado Líquido menos o já Liquidado. Representa o valor que ainda pode ser liquidado."
      />
    </div>
  );
}
