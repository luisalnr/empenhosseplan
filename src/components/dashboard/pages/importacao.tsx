"use client";
import * as React from "react";
import {
  FileText,
  FileCheck2,
  Wallet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  Trash2,
  ListChecks,
  Info,
  type LucideIcon,
} from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { exerciciosDe } from "@/lib/exercicio";
import { parseSicafXlsx, COLUNAS_EMPENHO } from "@/lib/parser";
import {
  parseLiquidacoesXlsx,
  parsePagamentosXlsx,
  COLUNAS_LIQUIDACAO,
  COLUNAS_PAGAMENTO,
} from "@/lib/parser-fases";
import { executarChecagens } from "@/lib/import-checks";
import type { Checagem, Empenho, FaseDespesa, ResultadoImportacao, StatusChecagem } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Slot = "empenho" | "liquidacao" | "pagamento";

interface SlotState {
  file: File | null;
  parsing: boolean;
  error: string | null;
  records: Empenho[] | FaseDespesa[];
  colunas: Record<string, boolean> | null;
  count: number;
}

/** Base ∪ arquivo, deduplicado por `numero` — o registro do arquivo prevalece. */
function unirPorNumero<T extends { numero: string }>(base: T[], doArquivo: T[]): T[] {
  if (!doArquivo.length) return base;
  const porNumero = new Map(base.map((r) => [r.numero, r]));
  for (const r of doArquivo) porNumero.set(r.numero, r);
  return [...porNumero.values()];
}

const emptySlot = (): SlotState => ({
  file: null,
  parsing: false,
  error: null,
  records: [],
  colunas: null,
  count: 0,
});

const SLOT_META: Record<
  Slot,
  {
    title: string;
    subtitle: string;
    colunas: string[];
    icon: LucideIcon;
    iconClass: string;
    ringClass: string;
  }
> = {
  empenho: {
    title: "Empenhos",
    subtitle: "Relatório SICAF · compromisso da despesa",
    colunas: COLUNAS_EMPENHO,
    icon: FileText,
    iconClass: "text-primary bg-primary/10",
    ringClass: "ring-primary/20",
  },
  liquidacao: {
    title: "Liquidações",
    subtitle: "Relatório SICAF · reconhecimento do direito do credor",
    colunas: COLUNAS_LIQUIDACAO,
    icon: FileCheck2,
    iconClass: "text-[hsl(var(--chart-1))] bg-[hsl(var(--chart-1)/0.12)]",
    ringClass: "ring-[hsl(var(--chart-1)/0.25)]",
  },
  pagamento: {
    title: "Pagamentos",
    subtitle: "Relatório SICAF · quitação financeira",
    colunas: COLUNAS_PAGAMENTO,
    icon: Wallet,
    iconClass: "text-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3)/0.18)]",
    ringClass: "ring-[hsl(var(--chart-3)/0.3)]",
  },
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusIcon(status: StatusChecagem) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "aviso":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case "erro":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function FileSlotCard({
  slot,
  state,
  onFile,
  onClear,
}: {
  slot: Slot;
  state: SlotState;
  onFile: (slot: Slot, file: File | null) => void;
  onClear: (slot: Slot) => void;
}) {
  const meta = SLOT_META[slot];
  const Icon = meta.icon;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) return;
    onFile(slot, f);
  };

  const stageIcon = (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
        meta.iconClass,
        meta.ringClass
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </div>
  );

  return (
    <Card className={cn("shrink-0 shadow-sm", dragOver && "ring-2 ring-primary/30")}>
      <CardContent className="space-y-1.5 p-2.5">
        {/* Cabeçalho: título + badge (ícone fica na zona de drop) */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{meta.title}</h3>
              {state.parsing ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analisando…
                </Badge>
              ) : state.error ? (
                <Badge variant="destructive" className="text-xs">
                  Erro
                </Badge>
              ) : state.file ? (
                <Badge variant="success" className="text-xs">
                  {state.count.toLocaleString("pt-BR")} registros
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Pendente
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />

        {/* Drop zone / arquivo — ícone da etapa mesclado aqui */}
        {state.file ? (
          <div className="flex min-h-[2.75rem] items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
            {stageIcon}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{state.file.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatBytes(state.file.size)}
                {state.colunas && (
                  <>
                    {" · "}
                    {meta.colunas.every((c) => state.colunas![c])
                      ? "todas as colunas presentes"
                      : `${meta.colunas.filter((c) => !state.colunas![c]).length} coluna(s) faltando`}
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                Trocar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  onClear(slot);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                aria-label="Remover arquivo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-2 transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
            )}
          >
            {stageIcon}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm leading-tight">
                <span className="font-medium text-foreground">Clique ou arraste</span>
                <span className="text-muted-foreground"> o arquivo .xlsx</span>
              </p>
            </div>
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        )}

        {state.error && <p className="text-xs text-destructive">{state.error}</p>}

        {/* Colunas em mini caixinhas */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[10px] font-medium text-muted-foreground">
            Colunas necessárias:
          </span>
          {meta.colunas.map((col) => {
            const found = state.colunas ? state.colunas[col] : undefined;
            return (
              <span
                key={col}
                title={col}
                className={cn(
                  "inline-flex max-w-full items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] leading-tight",
                  found === true && "bg-success/10 text-success",
                  found === false && "bg-destructive/10 text-destructive",
                  found === undefined && "bg-muted text-muted-foreground"
                )}
              >
                {found === true ? (
                  <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                ) : found === false ? (
                  <XCircle className="h-2.5 w-2.5 shrink-0" />
                ) : null}
                <span className="truncate">{col.replace(" (R$)", "")}</span>
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Lista os nºs de empenho por trás de uma checagem — antes só havia a contagem. */
function ItensPopover({
  label,
  itens,
  total,
}: {
  label: string;
  itens: string[];
  total: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 self-center px-1.5 text-[10px] font-medium"
        >
          ver
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">
            {total.toLocaleString("pt-BR")} registro{total > 1 ? "s" : ""}
            {total > itens.length && ` — mostrando os ${itens.length} primeiros`}
          </p>
        </div>
        <div className="max-h-56 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {itens.map((n) => (
              <li key={n} className="font-mono text-[11px] text-muted-foreground">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChecagensPanel({ checagens }: { checagens: Checagem[] }) {
  const resumo = React.useMemo(() => {
    const r = { ok: 0, aviso: 0, erro: 0, pendente: 0 };
    for (const c of checagens) r[c.status] += 1;
    return r;
  }, [checagens]);

  return (
    <Card className="flex h-full w-full min-h-0 flex-col overflow-hidden shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-2.5 py-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
          <ListChecks className="h-3.5 w-3.5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            Painel de checagens
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="success" className="h-5 px-1.5 text-[10px]">
            {resumo.ok} ok
          </Badge>
          <Badge variant="warning" className="h-5 px-1.5 text-[10px]">
            {resumo.aviso} av.
          </Badge>
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
            {resumo.erro} er.
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {resumo.pendente} pe.
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
        {checagens.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex gap-1.5 rounded-md border px-2 py-1",
              c.status === "ok" && "border-success/30 bg-success/5",
              c.status === "aviso" && "border-warning/30 bg-warning/5",
              c.status === "erro" && "border-destructive/30 bg-destructive/5",
              c.status === "pendente" && "border-border bg-muted/20"
            )}
          >
            <div className="mt-0.5 shrink-0">{statusIcon(c.status)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug text-foreground">{c.label}</p>
              {c.detalhe && (
                <p className="text-[10px] leading-snug text-muted-foreground">{c.detalhe}</p>
              )}
            </div>
            {c.itens && c.itens.length > 0 && (
              <ItensPopover label={c.label} itens={c.itens} total={c.count ?? c.itens.length} />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ImportacaoPage() {
  const { mto, empenhos, liquidacoes, pagamentos, importarTudo } = useDashboard();

  const [slots, setSlots] = React.useState<Record<Slot, SlotState>>({
    empenho: emptySlot(),
    liquidacao: emptySlot(),
    pagamento: emptySlot(),
  });
  const [mode, setMode] = React.useState<"merge" | "replace">("replace");

  // Exercícios detectados na planilha de empenhos: é o escopo exato do "Substituir".
  const exerciciosDoArquivo = React.useMemo(
    () => exerciciosDe(slots.empenho.records as Empenho[]),
    [slots.empenho.records]
  );
  const [importing, setImporting] = React.useState(false);
  const [resultados, setResultados] = React.useState<ResultadoImportacao[] | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  const parseSlot = React.useCallback(
    async (slot: Slot, file: File) => {
      setSlots((prev) => ({
        ...prev,
        [slot]: { ...emptySlot(), file, parsing: true },
      }));
      try {
        if (slot === "empenho") {
          if (!mto) throw new Error("Dados de referência (MTO) ainda carregando");
          const r = await parseSicafXlsx(file, mto);
          setSlots((prev) => ({
            ...prev,
            empenho: {
              file,
              parsing: false,
              error: null,
              records: r.records,
              colunas: r.colunasEncontradas,
              count: r.records.length,
            },
          }));
        } else if (slot === "liquidacao") {
          const r = await parseLiquidacoesXlsx(file);
          setSlots((prev) => ({
            ...prev,
            liquidacao: {
              file,
              parsing: false,
              error: null,
              records: r.records,
              colunas: r.colunasEncontradas,
              count: r.records.length,
            },
          }));
        } else {
          const r = await parsePagamentosXlsx(file);
          setSlots((prev) => ({
            ...prev,
            pagamento: {
              file,
              parsing: false,
              error: null,
              records: r.records,
              colunas: r.colunasEncontradas,
              count: r.records.length,
            },
          }));
        }
      } catch (e) {
        setSlots((prev) => ({
          ...prev,
          [slot]: {
            file,
            parsing: false,
            error: e instanceof Error ? e.message : "Falha ao ler o arquivo",
            records: [],
            colunas: null,
            count: 0,
          },
        }));
      }
    },
    [mto]
  );

  const onFile = (slot: Slot, file: File | null) => {
    setResultados(null);
    setImportError(null);
    if (!file) return;
    void parseSlot(slot, file);
  };

  const onClear = (slot: Slot) => {
    setResultados(null);
    setImportError(null);
    setSlots((prev) => ({ ...prev, [slot]: emptySlot() }));
  };

  // O cruzamento roda sobre base ∪ arquivo. Antes o arquivo SUBSTITUÍA a base, e toda
  // fase cujo empenho já estava persistido virava "órfã" — falso positivo garantido.
  const previewEmpenhos = React.useMemo(
    () => unirPorNumero(empenhos, slots.empenho.records as Empenho[]),
    [empenhos, slots.empenho.records]
  );
  const previewLiq = React.useMemo(
    () => unirPorNumero(liquidacoes, slots.liquidacao.records as FaseDespesa[]),
    [liquidacoes, slots.liquidacao.records]
  );
  const previewPag = React.useMemo(
    () => unirPorNumero(pagamentos, slots.pagamento.records as FaseDespesa[]),
    [pagamentos, slots.pagamento.records]
  );

  const checagens = React.useMemo(
    () =>
      executarChecagens({
        empenhos: previewEmpenhos,
        liquidacoes: previewLiq,
        pagamentos: previewPag,
        colunasEmpenho: slots.empenho.colunas,
        colunasLiquidacao: slots.liquidacao.colunas,
        colunasPagamento: slots.pagamento.colunas,
        temArquivoEmpenho: Boolean(slots.empenho.file),
        temArquivoLiquidacao: Boolean(slots.liquidacao.file),
        temArquivoPagamento: Boolean(slots.pagamento.file),
      }),
    [
      previewEmpenhos,
      previewLiq,
      previewPag,
      slots.empenho.colunas,
      slots.empenho.file,
      slots.liquidacao.colunas,
      slots.liquidacao.file,
      slots.pagamento.colunas,
      slots.pagamento.file,
    ]
  );

  const canImport =
    Boolean(slots.empenho.file || slots.liquidacao.file || slots.pagamento.file) &&
    !slots.empenho.parsing &&
    !slots.liquidacao.parsing &&
    !slots.pagamento.parsing &&
    !importing;

  const processar = async () => {
    setImporting(true);
    setImportError(null);
    setResultados(null);
    try {
      const res = await importarTudo({
        empenho: slots.empenho.file,
        liquidacao: slots.liquidacao.file,
        pagamento: slots.pagamento.file,
        mode,
      });
      setResultados(res);
      setSlots({
        empenho: emptySlot(),
        liquidacao: emptySlot(),
        pagamento: emptySlot(),
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      {/* Cabeçalho da página */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Importação de relatórios
          </h2>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            Envie os arquivos de empenho, liquidação e pagamento exportados do SICAF.
          </p>
        </div>
        <p className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
          Em base: {empenhos.length.toLocaleString("pt-BR")} emp. ·{" "}
          {liquidacoes.length.toLocaleString("pt-BR")} liq. ·{" "}
          {pagamentos.length.toLocaleString("pt-BR")} pag.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-2 lg:grid-cols-5">
        {/*
          Esquerda: uploads rolam internamente; barra de ação no rodapé da coluna.
          Direita: painel de checagens com h-full — bases das colunas alinhadas.
        */}
        <div className="flex h-full min-h-0 flex-col gap-2 lg:col-span-3">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            <FileSlotCard slot="empenho" state={slots.empenho} onFile={onFile} onClear={onClear} />
            <FileSlotCard
              slot="liquidacao"
              state={slots.liquidacao}
              onFile={onFile}
              onClear={onClear}
            />
            <FileSlotCard
              slot="pagamento"
              state={slots.pagamento}
              onFile={onFile}
              onClear={onClear}
            />

            {importError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {importError}
              </div>
            )}

            {resultados && !importError && (
              <div className="flex flex-wrap gap-2">
                {resultados.map((r) => (
                  <div
                    key={r.tipo}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                      r.ok
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    {r.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {r.tipo === "empenho"
                      ? "Empenhos"
                      : r.tipo === "liquidacao"
                        ? "Liquidações"
                        : "Pagamentos"}
                    {r.ok
                      ? ` — ${r.registros.toLocaleString("pt-BR")} reg.`
                      : r.erros[0]
                        ? ` — ${r.erros[0]}`
                        : " — falha"}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Barra de ações compacta — base alinhada ao painel de checagens */}
          <Card className="z-10 shrink-0 border-border shadow-md">
            <CardContent className="flex flex-col gap-2 px-3 py-2">
              <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-foreground sm:text-sm">
                    Modo de importação
                  </span>
                  <div className="flex rounded-md border border-border p-0.5">
                    <button
                      type="button"
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
                        mode === "replace"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setMode("replace")}
                    >
                      Substituir exercício
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
                        mode === "merge"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setMode("merge")}
                    >
                      Mesclar
                    </button>
                  </div>
                </div>
                <Button
                  disabled={!canImport}
                  onClick={processar}
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs sm:min-w-[9rem]"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" /> Importar tudo
                    </>
                  )}
                </Button>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {mode === "replace" ? (
                  <span>
                    <strong className="font-medium text-foreground">Substituir exercício:</strong>{" "}
                    apaga os registros{" "}
                    {exerciciosDoArquivo.length ? (
                      <>
                        do exercício{" "}
                        <strong className="font-medium text-foreground">
                          {exerciciosDoArquivo.join(", ")}
                        </strong>
                      </>
                    ) : (
                      "do exercício contido na planilha"
                    )}{" "}
                    e regrava tudo a partir do arquivo. Use quando o relatório é a versão
                    definitiva do ano. Os <strong className="font-medium text-foreground">demais
                    exercícios não são afetados</strong>.
                  </span>
                ) : (
                  <span>
                    <strong className="font-medium text-foreground">Mesclar:</strong> não apaga
                    nada. Empenhos já existentes (mesmo número) são atualizados com os valores do
                    arquivo, e os que não existem são acrescentados. Use para importar um relatório
                    parcial ou complementar um exercício já carregado.
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Direita: mesma altura da coluna esquerda */}
        <div className="flex min-h-[12rem] flex-col lg:col-span-2 lg:min-h-0">
          <ChecagensPanel checagens={checagens} />
        </div>
      </div>
    </div>
  );
}
