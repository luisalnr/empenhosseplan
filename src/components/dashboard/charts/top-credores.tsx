"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { topCredores } from "@/lib/aggregations";
import { formatCompactShort } from "@/lib/utils";
import type { Empenho } from "@/lib/types";
import { CurrencyTooltip } from "./chart-tooltip";

function truncar(s: string, n = 32) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Mantém apenas despesas de modalidade "Aplicações Diretas" (cód. 90–96),
 * excluindo transferências a municípios e demais modalidades de transferência.
 */
function isAplicacaoDireta(e: Empenho): boolean {
  const cod = (e.modalidade?.codigo || "").trim();
  const desc = (e.modalidade?.descricao || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Transferências (municípios e demais) — sempre fora
  if (
    desc.includes("transfer") ||
    desc.includes("municip") ||
    /^[2345678]\d$/.test(cod) // 20–80 família de transferências/delegações
  ) {
    return false;
  }

  // Aplicações Diretas: 90 (e variantes 91–96 de aplicação direta no MTO)
  if (/^9[0-6]$/.test(cod)) return true;
  if (desc.includes("aplica") && desc.includes("direta")) return true;

  return false;
}

export function TopCredores() {
  const { filtered } = useDashboard();
  const data = React.useMemo(() => {
    const soDiretas = filtered.filter(isAplicacaoDireta);
    return topCredores(soDiretas, 10)
      .map((g) => ({
        label: truncar(g.label, 30),
        Empenhado: Math.round(g.empenhado - g.anulado),
        Liquidado: Math.round(g.liquidado),
      }))
      .sort((a, b) => b.Empenhado - a.Empenhado);
  }, [filtered]);

  const alturaDinamica = Math.max(220, data.length * 38);

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden pr-1">
      <ResponsiveContainer width="100%" height={alturaDinamica}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCompactShort(v)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 10.5, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            width={190}
          />
          <Tooltip content={<CurrencyTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar dataKey="Empenhado" name="Empenhado Líquido" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} maxBarSize={20} />
          <Bar dataKey="Liquidado" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
