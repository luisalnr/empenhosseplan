"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { useAuth } from "@/components/providers/auth-provider";
import type { Pagina } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PAGINAS_BASE: { id: Pagina; label: string }[] = [
  { id: "sintese", label: "Síntese" },
  { id: "empenhos", label: "Empenhos" },
  { id: "risco", label: "Análise de Risco" },
  { id: "resumo", label: "Resumo por Credor" },
  { id: "importacao", label: "Importação" },
];

function isEditable(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  const role = el.getAttribute("role");
  return role === "combobox" || role === "listbox" || role === "textbox";
}

export function PageNavigator() {
  const { pagina, setPagina } = useDashboard();
  const { isAdmin } = useAuth();
  const PAGINAS = React.useMemo(
    () =>
      isAdmin
        ? [...PAGINAS_BASE, { id: "usuarios" as Pagina, label: "Usuários" }]
        : PAGINAS_BASE,
    [isAdmin]
  );
  const idx = PAGINAS.findIndex((p) => p.id === pagina);

  // Se perdeu admin e estava em usuários, volta para síntese
  React.useEffect(() => {
    if (!isAdmin && pagina === "usuarios") setPagina("sintese");
  }, [isAdmin, pagina, setPagina]);

  const ir = React.useCallback(
    (delta: number) => {
      const next = Math.min(PAGINAS.length - 1, Math.max(0, idx + delta));
      setPagina(PAGINAS[next].id);
    },
    [idx, setPagina]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        ir(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        ir(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir]);

  return (
    <nav className="sticky bottom-0 z-30 shrink-0 border-t border-border bg-card/80 backdrop-blur">
      <div className="flex items-center justify-center gap-1 px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => ir(-1)}
          disabled={idx === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          {PAGINAS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPagina(p.id)}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                i === idx
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => ir(1)}
          disabled={idx === PAGINAS.length - 1}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="pb-1 text-center text-[10px] text-muted-foreground">
        Use as setas ← → do teclado para navegar entre as páginas
      </p>
    </nav>
  );
}
