"use client";
import Image from "next/image";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, CalendarRange, LogOut } from "lucide-react";
import { formatPeriodo } from "@/lib/periodo";

export function Header() {
  const { ultimaAtualizacao, periodoAnalise, loading } = useDashboard();
  const { user, logout } = useAuth();
  const periodoLabel = formatPeriodo(periodoAnalise);

  return (
    <header className="sticky top-0 z-40 w-full bg-bar text-bar-foreground shadow-lg">
      <div className="flex min-h-16 items-center gap-4 px-4 py-2 sm:px-6">
        <div className="relative h-9 w-[150px] shrink-0">
          <Image
            src="/logo-acre-branco.png"
            alt="Governo do Estado do Acre"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="h-8 w-px bg-white/20 hidden sm:block" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
            Execução de Empenhos
          </h1>
          <p className="truncate text-xs text-white/70">
            Secretaria de Estado de Planejamento do Acre
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {loading ? (
            <Badge className="border-white/20 bg-white/10 text-white/80">Carregando…</Badge>
          ) : (
            (ultimaAtualizacao || periodoLabel) && (
              <div className="hidden flex-col items-end gap-0.5 text-xs text-white/70 md:flex">
                {ultimaAtualizacao && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    Atualizado em {ultimaAtualizacao}
                  </span>
                )}
                {periodoLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                    Período: {periodoLabel}
                  </span>
                )}
              </div>
            )
          )}
          {user && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 gap-1.5 border border-white/20 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20 hover:text-white"
              title={`Sair (${user.email})`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          )}
          <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        </div>
      </div>
    </header>
  );
}
