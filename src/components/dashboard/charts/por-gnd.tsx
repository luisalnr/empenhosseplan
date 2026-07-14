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
import { porGnd } from "@/lib/aggregations";
import { formatCompactShort } from "@/lib/utils";
import { CurrencyTooltip } from "./chart-tooltip";

const MAX_CHARS_LINHA = 18;
const MAX_LINHAS = 3;

/** Quebra o rótulo em linhas por palavra, para que o eixo fique na horizontal. */
function quebrarEmLinhas(texto: string): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    if (!atual) atual = palavra;
    else if (`${atual} ${palavra}`.length <= MAX_CHARS_LINHA) atual = `${atual} ${palavra}`;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > MAX_LINHAS) {
    const cortadas = linhas.slice(0, MAX_LINHAS);
    cortadas[MAX_LINHAS - 1] = `${cortadas[MAX_LINHAS - 1]}…`;
    return cortadas;
  }
  return linhas;
}

function TickCategoria({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const linhas = quebrarEmLinhas(payload?.value ?? "");
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10.5}>
        {linhas.map((linha, i) => (
          <tspan key={linha} x={0} dy={i === 0 ? 12 : 12}>
            {linha}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function PorGnd() {
  const { filtered } = useDashboard();
  const data = React.useMemo(
    () =>
      porGnd(filtered).map((g) => ({
        label: g.label.replace(/^(\d)\s*-\s*/, `${g.key} · `),
        Empenhado: Math.round(g.empenhado - g.anulado),
        Liquidado: Math.round(g.liquidado),
      })),
    [filtered]
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))" }}
          interval={0}
          tick={<TickCategoria />}
          height={56}
        />
        <YAxis
          tickFormatter={(v) => formatCompactShort(v)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="Empenhado" name="Empenhado Líquido" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Liquidado" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
