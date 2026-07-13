"use client";
import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  className,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="flex flex-shrink-0 flex-row items-start justify-between gap-2 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <CardTitle className="text-foreground">{title}</CardTitle>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </CardHeader>
      {/* relative + absolute garante altura definida para ResponsiveContainer height="100%" */}
      <CardContent className="relative min-h-0 flex-1 overflow-hidden p-0">
        <div className="absolute inset-0 overflow-hidden p-4 pt-0">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];
