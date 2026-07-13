"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { porMes } from "@/lib/aggregations";
import { formatCompactShort, monthLabel } from "@/lib/utils";
import { CurrencyTooltip } from "./chart-tooltip";

export function ExecucaoMensal() {
  const { filtered } = useDashboard();
  const data = React.useMemo(
    () =>
      porMes(filtered).map((g) => ({
        mes: monthLabel(g.key),
        Empenhado: Math.round(g.liquido),
        Liquidado: Math.round(g.liquidado),
      })),
    [filtered]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          {[
            { key: "Empenhado", color: "hsl(var(--chart-4))" },
            { key: "Liquidado", color: "hsl(var(--chart-1))" },
          ].map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
        <YAxis
          tickFormatter={(v) => formatCompactShort(v)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Area type="monotone" dataKey="Empenhado" name="Empenhado Líquido" stroke="hsl(var(--chart-4))" fill="url(#grad-Empenhado)" strokeWidth={2} />
        <Area type="monotone" dataKey="Liquidado" name="Liquidado" stroke="hsl(var(--chart-1))" fill="url(#grad-Liquidado)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
