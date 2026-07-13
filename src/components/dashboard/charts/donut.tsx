"use client";
import * as React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { CHART_COLORS } from "../chart-card";

interface DonutProps {
  data: { label: string; value: number }[];
}

function truncar(s: string, n = 26) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function CurrencyDonutTooltip({ active, payload }: { active?: boolean; payload?: { name?: string; value?: number; payload?: { label?: string; value?: number; pct?: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{p.label}</p>
      <p className="text-muted-foreground">
        {formatCurrency(p.value ?? 0)} · {formatPercent(p.pct ?? 0)}
      </p>
    </div>
  );
}

export function Donut({ data }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const withPct = data.map((d) => ({ ...d, pct: total ? d.value / total : 0 }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={withPct}
          dataKey="value"
          nameKey="label"
          cx="38%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {withPct.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CurrencyDonutTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, lineHeight: "20px", maxHeight: "100%", overflow: "hidden" }}
          formatter={(value: string) => (
            <span className="text-muted-foreground" title={value}>{truncar(value, 26)}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
