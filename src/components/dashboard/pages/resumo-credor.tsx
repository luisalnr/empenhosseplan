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
import { porFonte, calcularTotais } from "@/lib/aggregations";
import { formatCurrency, formatCompactShort, formatDate, cn } from "@/lib/utils";
import { KpiCard } from "../kpi-card";
import { ChartCard } from "../chart-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyTooltip } from "../charts/chart-tooltip";
import { loadLiquidacoes, loadPagamentos, indexByEmpenho } from "@/lib/fases";
import type { FaseDespesa } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Check, Filter, ChevronLeft, ChevronRight, ChevronDown, ScrollText, FileCheck2, Receipt, Hourglass, Files, FileX } from "lucide-react";

function CredorSelector({
  value,
  onChange,
  credores,
}: {
  value: string;
  onChange: (v: string) => void;
  credores: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const filtrados = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return credores;
    return credores.filter((c) => c.toLowerCase().includes(q));
  }, [credores, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-11 w-full justify-between text-sm font-medium">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Selecione um credor…"}
          </span>
          <Filter className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar credor…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum credor encontrado.</CommandEmpty>
            <CommandGroup>
              {filtrados.map((c) => (
                <CommandItem
                  key={c}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function truncar(s: string, n = 30) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function ResumoCredorPage() {
  const { empenhos, opcoes } = useDashboard();
  const [exercicio, setExercicio] = React.useState("");
  const [credor, setCredor] = React.useState("");
  const [liqMap, setLiqMap] = React.useState<Map<string, FaseDespesa[]>>(new Map());
  const [pagMap, setPagMap] = React.useState<Map<string, FaseDespesa[]>>(new Map());
  const [expandido, setExpandido] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const [liq, pag] = await Promise.all([loadLiquidacoes(), loadPagamentos()]);
      if (active) {
        setLiqMap(indexByEmpenho(liq));
        setPagMap(indexByEmpenho(pag));
      }
    })();
    return () => { active = false; };
  }, []);

  // O exercício é seleção única e sempre preenchida: por padrão, o mais recente.
  React.useEffect(() => {
    if (exercicio || opcoes.exercicios.length === 0) return;
    setExercicio(opcoes.exercicios[0]);
  }, [exercicio, opcoes.exercicios]);

  // Só os empenhos do exercício selecionado — os credores e KPIs derivam daqui.
  const empenhosDoExercicio = React.useMemo(
    () => empenhos.filter((e) => e.exercicio === exercicio),
    [empenhos, exercicio]
  );

  // estado de paginação simples para alternar entre credores
  const credores = React.useMemo(
    () => [...new Set(empenhosDoExercicio.map((e) => e.credor))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [empenhosDoExercicio]
  );

  // Ao trocar de exercício, o credor selecionado pode não existir mais.
  React.useEffect(() => {
    if (credor && !credores.includes(credor)) setCredor("");
  }, [credor, credores]);

  const pageIdx = credor ? credores.indexOf(credor) : -1;

  const irCredor = (delta: number) => {
    const base = pageIdx >= 0 ? pageIdx : -1;
    const next = Math.min(credores.length - 1, Math.max(0, base + delta));
    setCredor(credores[next]);
  };

  const empenhosDoCredor = React.useMemo(
    () => empenhosDoExercicio.filter((e) => e.credor === credor),
    [empenhosDoExercicio, credor]
  );

  const totais = React.useMemo(() => calcularTotais(empenhosDoCredor), [empenhosDoCredor]);

  const porFonteData = React.useMemo(
    () => porFonte(empenhosDoCredor),
    [empenhosDoCredor]
  );

  const chartData = React.useMemo(
    () =>
      porFonteData
        .map((g) => ({
          label: truncar(`${g.key} · ${g.label}`, 30),
          "Empenhado Líquido": Math.round(g.empenhado - g.anulado),
          Liquidado: Math.round(g.liquidado),
          Pago: Math.round(g.pago),
        }))
        .sort((a, b) => a["Empenhado Líquido"] - b["Empenhado Líquido"]),
    [porFonteData]
  );

  const fasesPorEmpenho = React.useMemo(() => {
    return empenhosDoCredor.map((e) => {
      const liqs = liqMap.get(e.numero) || [];
      const pags = pagMap.get(e.numero) || [];
      const totalLiq = liqs.reduce((s, l) => s + (l.valor ?? 0), 0);
      const totalPag = pags.reduce((s, p) => s + (p.valor ?? 0), 0);
      return {
        empenho: e,
        liqs,
        pags,
        totalLiq,
        totalPag,
      };
    });
  }, [empenhosDoCredor, liqMap, pagMap]);

  const exercicioSelect = (
    <Select value={exercicio} onValueChange={setExercicio}>
      <SelectTrigger className="h-11 w-full min-w-[7rem] sm:w-[9rem]">
        <SelectValue placeholder="Exercício" />
      </SelectTrigger>
      <SelectContent>
        {opcoes.exercicios.map((ex) => (
          <SelectItem key={ex} value={ex}>
            {ex}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!credor) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {exercicioSelect}
          <div className="flex-1">
            <CredorSelector value={credor} onChange={setCredor} credores={credores} />
          </div>
        </div>
        <Card className="flex h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <FileX className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Nenhum credor selecionado</p>
            <p className="text-sm text-muted-foreground">
              Selecione um credor acima para visualizar o resumo de seus empenhos por fonte de recursos.
            </p>
          </div>
        </Card>
      </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase().trim();
  const variant =
    s === "efetuado" || s === "efetivado"
      ? "success"
      : s === "cancelado"
      ? "destructive"
      : s.includes("aguardando")
      ? "warning"
      : "outline";
  return <Badge variant={variant}>{status.trim()}</Badge>;
}

  return (
    <div className="space-y-3">
      {/* Seletor de exercício e de credor com navegação */}
      <div className="flex items-center gap-2">
        <div className="shrink-0">{exercicioSelect}</div>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => irCredor(-1)} disabled={pageIdx <= 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <CredorSelector value={credor} onChange={setCredor} credores={credores} />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => irCredor(1)} disabled={pageIdx >= credores.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* KPIs do credor */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
        <KpiCard label="Empenhado Líquido" value={formatCurrency(totais.liquido)} icon={ScrollText} tone="primary" hint="Empenhado − Anulado" info="Total empenhado menos anulações para o credor selecionado." />
        <KpiCard label="Liquidado" value={formatCurrency(totais.liquidado)} icon={FileCheck2} tone="success" info="Soma dos valores liquidados para o credor selecionado." />
        <KpiCard label="Pago" value={formatCurrency(totais.pago)} icon={Receipt} tone="success" info="Soma dos valores efetivamente pagos ao credor selecionado." />
        <KpiCard label="A Liquidar" value={formatCurrency(totais.aLiquidar)} icon={Hourglass} tone="warning" info="Empenhado Líquido menos o já Liquidado." />
        <KpiCard label="Qtd. Empenhos" value={totais.qtdEmpenhos.toLocaleString("pt-BR")} icon={Files} tone="default" info="Quantidade de notas de empenho emitidas para o credor." />
      </div>

      {/* Grid: chart + tabela por fonte */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Chart por fonte */}
        <ChartCard title="Por fonte de recursos" subtitle="Empenhado líquido, liquidado e pago" className="h-full min-h-[400px] lg:col-span-2">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatCompactShort(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} width={150} />
                <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="Empenhado Líquido" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} maxBarSize={16} />
                <Bar dataKey="Liquidado" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={16} />
                <Bar dataKey="Pago" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Tabela de empenhos do credor */}
        <Card className="flex flex-col overflow-hidden lg:col-span-3">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Empenhos do credor</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{empenhosDoCredor.length} empenho(s) · {porFonteData.length} fonte(s) de recursos</p>
          </div>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Nº Empenho</TableHead>
                  <TableHead className="min-w-[280px]">Descrição</TableHead>
                  <TableHead className="text-right">Empenhado Líquido</TableHead>
                  <TableHead className="text-right">Liquidado</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empenhosDoCredor.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Sem dados</TableCell>
                  </TableRow>
                ) : (
                  [...empenhosDoCredor]
                    .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao))
                    .map((e) => (
                    <TableRow key={e.numero}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{e.numero}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={e.descricao}>
                        {e.descricao || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(e.valor - e.anulado)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(e.liquidado)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(e.pago)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold uppercase text-xs tracking-wide">Total</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totais.liquido)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totais.liquidado)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totais.pago)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Card>
      </div>

      {/* Fases da despesa — Liquidação e Pagamento (acordeão por empenho) */}
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Fases da despesa — Liquidação e Pagamento</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fasesPorEmpenho.length} empenho(s) · clique em um empenho para expandir os detalhes
          </p>
        </div>
        <div className="max-h-[500px] overflow-auto">
          {fasesPorEmpenho.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          ) : (
            fasesPorEmpenho.map(({ empenho, liqs, pags, totalLiq, totalPag }) => {
              const isOpen = expandido === empenho.numero;
              return (
                <div key={empenho.numero} className="border-b border-border last:border-b-0">
                  {/* Cabeçalho clicável */}
                  <button
                    type="button"
                    onClick={() => setExpandido(isOpen ? null : empenho.numero)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-medium text-foreground">{empenho.numero}</p>
                      <p className="max-w-[400px] truncate text-xs text-muted-foreground" title={empenho.descricao}>
                        {empenho.descricao || "—"}
                      </p>
                    </div>
                    {/* Barra de progresso: liquidado / empenhado líquido */}
                    <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
                      <div className="h-2.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, (empenho.valor - empenho.anulado > 0 ? (empenho.liquidado / (empenho.valor - empenho.anulado)) * 100 : 0)))}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-[11px] text-muted-foreground">
                        {(empenho.valor - empenho.anulado > 0
                          ? ((empenho.liquidado / (empenho.valor - empenho.anulado)) * 100).toFixed(1).replace(".", ",")
                          : "0") + "%"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{liqs.length}</span> liq
                        {liqs.length > 0 && <span className="ml-1 tabular-nums">{formatCurrency(totalLiq)}</span>}
                      </span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{pags.length}</span> pag
                        {pags.length > 0 && <span className="ml-1 tabular-nums">{formatCurrency(totalPag)}</span>}
                      </span>
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {isOpen && (
                    <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-2">
                      {/* Sub-tabela Liquidações */}
                      <div className="bg-card p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Liquidações ({liqs.length})
                        </p>
                        {liqs.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">Sem liquidações</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Nº</TableHead>
                                <TableHead className="text-xs">Data</TableHead>
                                <TableHead className="text-right text-xs">Valor</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {liqs.map((l) => (
                                <TableRow key={l.numero}>
                                  <TableCell className="whitespace-nowrap font-mono text-xs">{l.numero}</TableCell>
                                  <TableCell className="whitespace-nowrap text-xs">{formatDate(l.data)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-xs">{formatCurrency(l.valor)}</TableCell>
                                  <TableCell><StatusBadge status={l.status} /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>

                      {/* Sub-tabela Pagamentos */}
                      <div className="bg-card p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Pagamentos ({pags.length})
                        </p>
                        {pags.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">Sem pagamentos</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Nº</TableHead>
                                <TableHead className="text-xs">Data</TableHead>
                                <TableHead className="text-right text-xs">Valor</TableHead>
                                <TableHead className="text-xs">Situação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pags.map((p) => (
                                <TableRow key={p.numero}>
                                  <TableCell className="whitespace-nowrap font-mono text-xs">{p.numero}</TableCell>
                                  <TableCell className="whitespace-nowrap text-xs">{formatDate(p.data)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-xs">{formatCurrency(p.valor)}</TableCell>
                                  <TableCell><StatusBadge status={p.status} /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
