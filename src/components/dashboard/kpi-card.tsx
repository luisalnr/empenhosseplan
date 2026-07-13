"use client";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  icon?: LucideIcon;
  progress?: number; // 0..1
  progressLabel?: string;
  progressInfo?: string;
  /** Se true, a cor da barra varia dinamicamente: verde (0%) → amarelo (50%) → vermelho (100%). */
  progressDynamic?: boolean;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
}

const toneMap = {
  default: { icon: "text-muted-foreground", bar: "bg-foreground" },
  primary: { icon: "text-primary", bar: "bg-primary" },
  success: { icon: "text-success", bar: "bg-success" },
  warning: { icon: "text-warning", bar: "bg-warning" },
  destructive: { icon: "text-destructive", bar: "bg-destructive" },
};

/** Cor HSL dinâmica: 0% verde (h=120) → 50% amarelo (h=50) → 100% vermelho (h=0). */
function dynamicBarColor(progress: number): string {
  const p = Math.min(1, Math.max(0, progress));
  let hue: number;
  if (p <= 0.5) {
    hue = 120 - (120 - 50) * (p / 0.5); // 120 → 50
  } else {
    hue = 50 - 50 * ((p - 0.5) / 0.5); // 50 → 0
  }
  return `hsl(${Math.round(hue)}, 70%, 45%)`;
}

export function KpiCard({ label, value, hint, info, icon: Icon, progress, progressLabel, progressInfo, progressDynamic = false, tone = "default" }: KpiCardProps) {
  const t = toneMap[tone];
  return (
    <Card className="relative overflow-hidden p-4 transition-shadow hover:shadow-card-hover">
      {/* Ícone grande mesclado ao fundo com baixa opacidade */}
      {Icon && (
        <Icon className={cn("pointer-events-none absolute -right-3 -top-2 h-20 w-20 opacity-[0.08]", t.icon)} strokeWidth={1.5} />
      )}

      <div className="relative flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/60 transition-colors hover:text-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-left leading-relaxed">
              {info}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <p className="relative mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="relative mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {typeof progress === "number" && (
        <div className="relative mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", !progressDynamic && t.bar)}
              style={{
                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                ...(progressDynamic ? { backgroundColor: dynamicBarColor(progress) } : {}),
              }}
            />
          </div>
          {(progressLabel || progress) && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {progressLabel ?? `${(progress * 100).toFixed(1).replace(".", ",")}%`}
              {progressInfo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 transition-colors hover:text-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] text-left leading-relaxed">
                    {progressInfo}
                  </TooltipContent>
                </Tooltip>
              )}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
