"use client";
import { Loader2, AlertTriangle, Database } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { Header } from "@/components/layout/header";
import { FilterBar } from "@/components/layout/filter-bar";
import { PageNavigator } from "@/components/layout/page-navigator";
import { SintesePage } from "@/components/dashboard/pages/sintese";
import { ResumoCredorPage } from "@/components/dashboard/pages/resumo-credor";
import { EmpenhosPage } from "@/components/dashboard/pages/empenhos";
import { RiscoPage } from "@/components/dashboard/pages/risco";
import { ImportacaoPage } from "@/components/dashboard/pages/importacao";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Page() {
  const { pagina, loading, error, empenhos, setPagina } = useDashboard();
  const hideFilterBar = pagina === "resumo" || pagina === "importacao";

  return (
    <div
      className={cn(
        "flex flex-col",
        pagina === "importacao" ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen"
      )}
    >
      <Header />
      {!hideFilterBar && <FilterBar />}

      <main
        className={cn(
          "flex-1 px-4 py-3 sm:px-6",
          pagina === "importacao" && "flex min-h-0 flex-col overflow-hidden pb-2"
        )}
      >
        {loading ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">Carregando dados de empenhos…</p>
          </div>
        ) : error ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Erro ao carregar os dados</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        ) : pagina === "importacao" ? (
          <div key={pagina} className="animate-fade-in flex min-h-0 flex-1 flex-col">
            <ImportacaoPage />
          </div>
        ) : empenhos.length === 0 ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Nenhum empenho carregado</p>
              <p className="text-sm text-muted-foreground">
                Importe os relatórios do SICAF/WW na aba Importação.
              </p>
            </div>
            <Button onClick={() => setPagina("importacao")}>Ir para Importação</Button>
          </div>
        ) : (
          <div key={pagina} className="animate-fade-in">
            {pagina === "sintese" && <SintesePage />}
            {pagina === "risco" && <RiscoPage />}
            {pagina === "resumo" && <ResumoCredorPage />}
            {pagina === "empenhos" && <EmpenhosPage />}
          </div>
        )}
      </main>

      <PageNavigator />
    </div>
  );
}
