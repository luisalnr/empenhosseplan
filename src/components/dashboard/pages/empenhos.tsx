"use client";
import * as React from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight, FileX } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import type { Empenho } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortKey = "numero" | "dataEmissao" | "tipo" | "credor" | "classe" | "descricao" | "elemento" | "fonte" | "valor" | "anulado" | "complemento" | "liquidado" | "pago" | "aLiquidar";

const COLS: { key: SortKey; label: string; numeric?: boolean; class?: string }[] = [
  { key: "numero", label: "Nº Empenho" },
  { key: "dataEmissao", label: "Emissão" },
  { key: "tipo", label: "Tipo" },
  { key: "credor", label: "Credor", class: "min-w-[200px]" },
  { key: "classe", label: "Classe", class: "min-w-[180px]" },
  { key: "descricao", label: "Descrição", class: "min-w-[280px]" },
  { key: "elemento", label: "Elemento", class: "min-w-[240px]" },
  { key: "fonte", label: "Fonte", class: "min-w-[180px]" },
  { key: "valor", label: "Valor", numeric: true },
  { key: "anulado", label: "Anulado", numeric: true },
  { key: "complemento", label: "Complemento", numeric: true },
  { key: "liquidado", label: "Liquidado", numeric: true },
  { key: "pago", label: "Pago", numeric: true },
  { key: "aLiquidar", label: "A Liquidar", numeric: true },
];

const PAGE_SIZE = 15;

function getCell(e: Empenho, key: SortKey) {
  switch (key) {
    case "elemento": return `${e.elemento.codigo} · ${e.elemento.descricao}`;
    case "fonte": return `${e.fonte.codigo} · ${e.fonte.descricao}`;
    case "classe": return `${e.classe.codigo} · ${e.classe.descricao}`;
    default: return e[key];
  }
}

function numValue(e: Empenho, key: SortKey) {
  if (["valor", "anulado", "complemento", "liquidado", "pago", "aLiquidar"].includes(key)) return e[key] as number;
  return 0;
}

function baixarCsv(rows: Empenho[]) {
  const head = ["N Empenho", "Emissao", "Tipo", "Credor", "Classe", "Descricao", "Elemento", "Fonte", "Valor", "Anulado", "Complemento", "Liquidado", "Pago", "A Liquidar"];
  const lines = rows.map((e) => [
    e.numero, e.dataEmissao, e.tipo, e.credor,
    `${e.classe.codigo} ${e.classe.descricao}`,
    e.descricao,
    `${e.elemento.codigo} ${e.elemento.descricao}`,
    `${e.fonte.codigo} ${e.fonte.descricao}`,
    e.valor, e.anulado, e.complemento, e.liquidado, e.pago, e.aLiquidar,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
  const csv = [head.map((h) => `"${h}"`).join(";"), ...lines].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `empenhos_seplan_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EmpenhosPage() {
  const { filtered } = useDashboard();
  const [busca, setBusca] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("dataEmissao");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(0);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    let rows = filtered;
    if (q) {
      rows = rows.filter((e) =>
        [e.numero, e.credor, e.tipo, e.classe.codigo, e.classe.descricao, e.descricao, e.elemento.codigo, e.elemento.descricao, e.fonte.codigo, e.fonte.descricao]
          .some((v) => v.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [filtered, busca]);

  const ordenados = React.useMemo(() => {
    const arr = [...filtrados];
    arr.sort((a, b) => {
      if (COLS.find((c) => c.key === sortKey)?.numeric) {
        return sortDir === "asc" ? numValue(a, sortKey) - numValue(b, sortKey) : numValue(b, sortKey) - numValue(a, sortKey);
      }
      const va = String(getCell(a, sortKey));
      const vb = String(getCell(b, sortKey));
      return sortDir === "asc" ? va.localeCompare(vb, "pt-BR") : vb.localeCompare(va, "pt-BR");
    });
    return arr;
  }, [filtrados, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages - 1);
  const pageRows = ordenados.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE);

  React.useEffect(() => setPage(0), [busca]);

  const totais = React.useMemo(() => {
    return filtrados.reduce(
      (acc, e) => {
        acc.valor += e.valor;
        acc.anulado += e.anulado;
        acc.complemento += e.complemento;
        acc.liquidado += e.liquidado;
        acc.pago += e.pago;
        acc.aLiquidar += e.aLiquidar;
        return acc;
      },
      { valor: 0, anulado: 0, complemento: 0, liquidado: 0, pago: 0, aLiquidar: 0 }
    );
  }, [filtrados]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empenho, credor, elemento…"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtrados.length.toLocaleString("pt-BR")} de {filtered.length.toLocaleString("pt-BR")} registros
        </span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => baixarCsv(ordenados)} disabled={!ordenados.length}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1500px]">
          <Table>
            <TableHeader>
              <TableRow>
                {COLS.map((c) => (
                  <TableHead key={c.key} className={cn(c.numeric && "text-right", c.class)}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.label}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS.length} className="h-32 text-center text-muted-foreground">
                    <FileX className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    Nenhum registro para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((e) => (
                  <TableRow key={e.numero}>
                    <TableCell className="font-mono text-xs">{e.numero}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.dataEmissao)}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.tipo}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={e.credor}>{e.credor}</TableCell>
                    <TableCell className="max-w-[180px] truncate" title={`${e.classe.codigo} · ${e.classe.descricao}`}>
                      <span className="text-muted-foreground">{e.classe.codigo}</span> · {e.classe.descricao}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={e.descricao}>{e.descricao}</TableCell>
                    <TableCell className="max-w-[240px] truncate" title={`${e.elemento.codigo} · ${e.elemento.descricao}`}>
                      <span className="text-muted-foreground">{e.elemento.codigo}</span> · {e.elemento.descricao}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={`${e.fonte.codigo} · ${e.fonte.descricao}`}>
                      <span className="text-muted-foreground">{e.fonte.codigo}</span> · {e.fonte.descricao}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.valor)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(e.anulado)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(e.complemento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.liquidado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.pago)}</TableCell>
                    <TableCell className="text-right tabular-nums text-warning">{formatCurrency(e.aLiquidar)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={8} className="font-semibold uppercase text-xs tracking-wide">
                  Total {filtrados.length.toLocaleString("pt-BR")} empenhos
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totais.valor)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-destructive">{formatCurrency(totais.anulado)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-muted-foreground">{formatCurrency(totais.complemento)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totais.liquidado)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totais.pago)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-warning">{formatCurrency(totais.aLiquidar)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border p-3">
        <span className="text-xs text-muted-foreground">
          Página {curPage + 1} de {totalPages}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={curPage === 0}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={curPage >= totalPages - 1}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
