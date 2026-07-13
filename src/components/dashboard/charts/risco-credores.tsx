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
import { formatCurrency, formatCompactShort } from "@/lib/utils";
import { riscoPorCredor } from "@/lib/risco";
import type { RiscoEmpenho } from "@/lib/types";

interface RiscoCredoresProps {
  riscos: RiscoEmpenho[];
}

function truncar(s: string, n = 32) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function RiscoCredorTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground" title={String(label ?? "")}>{label}</p>
      <div className="space-y-0.5">
        {payload.map((e, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.name}
            </span>
            <span className="font-medium text-foreground">{formatCurrency(Number(e.value) || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiscoCredores({ riscos }: RiscoCredoresProps) {
  const data = React.useMemo(() => {
    return riscoPorCredor(riscos, 10).map((c) => ({
      label: truncar(c.credor, 30),
      "Não Processado": Math.round(c.valorRNP),
      "Processado": Math.round(c.valorRP),
    }));
  }, [riscos]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Nenhum credor com empenhos em risco.
      </div>
    );
  }

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
          <Tooltip content={<RiscoCredorTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar dataKey="Não Processado" stackId="r" fill="#FBA96F" radius={[0, 0, 0, 0]} maxBarSize={22} />
          <Bar dataKey="Processado" stackId="r" fill="#FCE06F" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
