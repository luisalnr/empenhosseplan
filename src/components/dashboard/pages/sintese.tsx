"use client";
import { KpiCards } from "../kpi-cards";
import { ChartCard } from "../chart-card";
import { ExecucaoMensal } from "../charts/execucao-mensal";
import { PorElemento } from "../charts/por-elemento";
import { PorFonte } from "../charts/por-fonte";
import { PorClasse } from "../charts/por-classe";
import { PorGnd } from "../charts/por-gnd";
import { PorModalidade } from "../charts/por-modalidade";
import { TopCredores } from "../charts/top-credores";

export function SintesePage() {
  return (
    <div className="space-y-3">
      <KpiCards />

      {/* Linha 1: colunas assimétricas — esquerda (donuts) + direita (principal) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Coluna esquerda: blocos menores de composição */}
        <div className="flex flex-col gap-3 lg:col-span-1">
          <ChartCard title="Por fonte de recursos" subtitle="Valor empenhado líquido" className="h-[340px]">
            <PorFonte />
          </ChartCard>
          <ChartCard title="Top 10 credores" subtitle="Por valor empenhado líquido e liquidado" className="h-[340px]">
            <TopCredores />
          </ChartCard>
        </div>

        {/* Coluna principal */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <ChartCard title="Execução mensal" subtitle="Empenhado líquido e liquidado por mês" className="h-[340px]">
            <ExecucaoMensal />
          </ChartCard>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <ChartCard title="Por classe de credor" subtitle="Valor empenhado líquido" className="h-[340px]">
              <PorClasse />
            </ChartCard>
            <ChartCard title="Por elemento de despesa" subtitle="Empenhado líquido vs. liquidado" className="h-[340px]">
              <PorElemento />
            </ChartCard>
          </div>
        </div>
      </div>

      {/* Linha 2: classificações orçamentárias (GND + Modalidade) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Grupo da natureza da despesa (GND)" subtitle="Empenhado líquido vs. liquidado" className="h-[360px]">
          <PorGnd />
        </ChartCard>
        <ChartCard title="Modalidade de aplicação" subtitle="Empenhado líquido vs. liquidado" className="h-[360px]">
          <PorModalidade />
        </ChartCard>
      </div>
    </div>
  );
}
