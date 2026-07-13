"use client";
import * as React from "react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { porFonte } from "@/lib/aggregations";
import { Donut } from "./donut";

export function PorFonte() {
  const { filtered } = useDashboard();
  const data = React.useMemo(
    () =>
      porFonte(filtered)
        .map((g) => ({ label: g.label, value: Math.round(g.empenhado - g.anulado) }))
        .filter((d) => d.value > 0),
    [filtered]
  );
  return <Donut data={data} />;
}
