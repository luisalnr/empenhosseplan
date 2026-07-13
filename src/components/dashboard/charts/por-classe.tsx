"use client";
import * as React from "react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { porClasse } from "@/lib/aggregations";
import { Donut } from "./donut";

export function PorClasse() {
  const { filtered } = useDashboard();
  const data = React.useMemo(
    () =>
      porClasse(filtered)
        .map((g) => ({ label: `${g.key} · ${g.label}`, value: Math.round(g.empenhado - g.anulado) }))
        .filter((d) => d.value > 0),
    [filtered]
  );
  return <Donut data={data} />;
}
