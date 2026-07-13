"use client";
import * as React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { RiscoAgregado } from "@/lib/types";

interface RiscoDonutProps {
  agregado: RiscoAgregado;
}

const COR_NP = "#a2825c"; // não processado — marrom/terracota
const COR_P = "#E09006";  // processado — âmbar

function RiscoTooltip({ active, payload }: { active?: boolean; payload?: { payload?: { label?: string; valor?: number; pct?: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{p.label}</p>
      <p className="text-muted-foreground">
        {formatCurrency(p.valor ?? 0)} · {formatPercent(p.pct ?? 0, 2)}
      </p>
    </div>
  );
}

export function RiscoDonut({ agregado }: RiscoDonutProps) {
  const data = React.useMemo(() => {
    const total = agregado.valorRNP + agregado.valorRP;
    return [
      { label: "Não Processado (A Liquidar)", valor: agregado.valorRNP, pct: total > 0 ? agregado.valorRNP / total : 0, cor: COR_NP },
      { label: "Processado (A Pagar)", valor: agregado.valorRP, pct: total > 0 ? agregado.valorRP / total : 0, cor: COR_P },
    ].filter((d) => d.valor > 0);
  }, [agregado]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sem empenhos em risco de restos a pagar.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="label"
          cx="38%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.cor} />
          ))}
        </Pie>
        <Tooltip content={<RiscoTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, lineHeight: "22px", maxHeight: "100%", overflow: "hidden" }}
          formatter={(value: string, _entry, i) => {
            const d = data[i];
            return (
              <span className="text-muted-foreground">
                {value} — {d ? `${formatCurrency(d.valor)} (${formatPercent(d.pct, 2)})` : ""}
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
