"use client";
import * as React from "react";
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Modo = "merge" | "replace";
type Estado = "idle" | "pronto" | "processando" | "ok" | "erro";

export function ImportDialog({ children }: { children: React.ReactNode }) {
  const { importar } = useDashboard();
  const [open, setOpen] = React.useState(false);
  const [estado, setEstado] = React.useState<Estado>("idle");
  const [modo, setModo] = React.useState<Modo>("merge");
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [msg, setMsg] = React.useState<string>("");
  const [contagem, setContagem] = React.useState<number>(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setEstado("idle");
    setArquivo(null);
    setMsg("");
    setContagem(0);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    reset();
    setArquivo(f);
    setEstado("pronto");
  };

  const processar = async () => {
    if (!arquivo) return;
    setEstado("processando");
    setMsg("");
    try {
      const n = await importar(arquivo, modo);
      setContagem(n);
      setEstado("ok");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao importar");
      setEstado("erro");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar planilha de empenhos
          </DialogTitle>
          <DialogDescription>
            Selecione um arquivo <strong>.xlsx</strong> exportado do SICAF/WW. O sistema
            localiza o cabeçalho automaticamente e enriquece os registros com a classificação
            do MTO (elemento, fonte, categoria, GND e modalidade).
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />

        {estado === "idle" && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Clique para selecionar o arquivo</span>
            <span className="text-xs text-muted-foreground">.xlsx — layout SICAF/WW</span>
          </button>
        )}

        {(estado === "pronto" || estado === "processando" || estado === "ok" || estado === "erro") && arquivo && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{arquivo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(arquivo.size / 1024).toFixed(0)} KB
                </p>
              </div>
              {estado !== "processando" && estado !== "ok" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  Trocar
                </Button>
              )}
            </div>

            {estado !== "ok" && estado !== "erro" && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Modo de importação
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ModoCard
                    active={modo === "merge"}
                    onClick={() => setModo("merge")}
                    titulo="Mesclar"
                    desc="Adiciona/atualiza empenhos pela chave de número (mantém o histórico)."
                  />
                  <ModoCard
                    active={modo === "replace"}
                    onClick={() => setModo("replace")}
                    titulo="Substituir tudo"
                    desc="Apaga os dados atuais e importa apenas a nova planilha."
                  />
                </div>
              </div>
            )}

            {estado === "ok" && (
              <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success/10 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div className="text-sm">
                  <p className="font-medium text-success">Importação concluída</p>
                  <p className="text-muted-foreground">
                    {contagem.toLocaleString("pt-BR")} registros processados com sucesso.
                  </p>
                </div>
              </div>
            )}

            {estado === "erro" && (
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Falha na importação</p>
                  <p className="text-muted-foreground">{msg}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {estado === "ok" ? (
            <Button type="button" onClick={() => setOpen(false)}>
              Concluir
            </Button>
          ) : estado === "erro" ? (
            <Button type="button" variant="outline" onClick={() => setEstado("pronto")}>
              Tentar novamente
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!arquivo || estado === "processando"}
                onClick={processar}
              >
                {estado === "processando" && <Loader2 className="h-4 w-4 animate-spin" />}
                {estado === "processando" ? "Processando…" : "Importar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModoCard({
  active,
  onClick,
  titulo,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"
      )}
    >
      <p className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>{titulo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
