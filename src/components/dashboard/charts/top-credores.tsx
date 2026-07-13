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
import { CurrencyTooltip } from "./chart-tooltip";

function truncar(s: string, n = 32) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function TopCredores() {
  const { filtered } = useDashboard();
  const data = React.useMemo(
    () =>
      topCredores(filtered, 10)
        .map((g) => ({
          label: truncar(g.label, 30),
          Empenhado: Math.round(g.empenhado - g.anulado),
          Liquidado: Math.round(g.liquidado),
        }))
        .sort((a, b) => b.Empenhado - a.Empenhado),
    [filtered]
  );

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
