"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, RotateCcw, Users, FileText } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { filtrosSchema, type FiltrosForm } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";

const CAMPOS_ATIVOS = [
  "exercicio",
  "credor",
  "elemento",
  "fonte",
  "tipo",
  "dataInicio",
  "dataFim",
] as const;

function FiltrosAtivosBadge({ valores }: { valores: FiltrosForm }) {
  const n = CAMPOS_ATIVOS.filter((k) => {
    const v = valores[k];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }).length;
  if (!n) return null;
  return <Badge variant="secondary" className="ml-1">{n} ativo{n > 1 ? "s" : ""}</Badge>;
}

type Opcao = { value: string; label: string; hint?: string };

function MultiSelect({
  value,
  onChange,
  opcoes,
  placeholder,
  buscaPlaceholder = "Buscar…",
  vazio = "Nenhuma opção encontrada.",
  larguraPopover = "w-[320px]",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  opcoes: Opcao[];
  placeholder: string;
  buscaPlaceholder?: string;
  vazio?: string;
  larguraPopover?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const rotulo =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (opcoes.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {rotulo}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(larguraPopover, "p-0")} align="start">
        <Command>
          <CommandInput placeholder={buscaPlaceholder} />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => {
                const marcado = value.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={`${o.hint ?? ""} ${o.label}`}
                    onSelect={() => toggle(o.value)}
                  >
                    <span
                      className={cn(
                        "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        marcado ? "bg-primary text-primary-foreground" : "opacity-60"
                      )}
                    >
                      {marcado && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">
                      {o.hint && <span className="text-muted-foreground">{o.hint} — </span>}
                      {o.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <Separator />
          <div className="flex items-center justify-between p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-normal"
              onClick={() => onChange(opcoes.map((o) => o.value))}
            >
              Selecionar tudo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-normal"
              disabled={value.length === 0}
              onClick={() => onChange([])}
            >
              Limpar
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar() {
  const { opcoes, filtrosPadrao, setFiltros, limparFiltros, totais, risco, pagina } =
    useDashboard();

  const form = useForm<FiltrosForm>({
    resolver: zodResolver(filtrosSchema),
    defaultValues: filtrosPadrao,
    mode: "onChange",
  });

  const valores = form.watch();
  const [resetKey, setResetKey] = React.useState(0);
  // Assinatura event-driven: só propaga ao contexto quando o formulário muda de fato.
  React.useEffect(() => {
    const sub = form.watch((data) => {
      setFiltros({
        exercicio: (data.exercicio ?? []).filter((v): v is string => !!v),
        credor: (data.credor ?? []).filter((v): v is string => !!v),
        elemento: (data.elemento ?? []).filter((v): v is string => !!v),
        fonte: (data.fonte ?? []).filter((v): v is string => !!v),
        tipo: (data.tipo ?? []).filter((v): v is string => !!v),
        dataInicio: data.dataInicio ?? "",
        dataFim: data.dataFim ?? "",
      });
    });
    return () => sub.unsubscribe();
  }, [form, setFiltros]);

  // Os empenhos chegam depois da 1ª renderização; quando o exercício padrão for
  // conhecido, o formulário passa a refleti-lo.
  React.useEffect(() => {
    if (!filtrosPadrao.exercicio.length) return;
    form.reset({ ...filtrosPadrao });
    setResetKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosPadrao]);

  const limpar = () => {
    form.reset({ ...filtrosPadrao });
    limparFiltros();
    setResetKey((k) => k + 1);
  };

  // min-w cabe "dd/mm/aaaa" + o ícone do date picker sem truncar em nenhum navegador.
  const dateInputCls =
    "h-9 w-full min-w-[8.5rem] rounded-md border border-input bg-card px-2 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form
      key={resetKey}
      className="flex flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-end xl:gap-4"
    >
      {/* Zona 1: filtros. Grid fluido — as colunas se reacomodam sem deixar buracos. */}
      <div className="grid flex-1 grid-cols-2 items-end gap-x-3 gap-y-2 md:grid-cols-4 xl:grid-cols-[7rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_20.5rem]">
        <Field label="Exercício">
          <MultiSelect
            value={form.watch("exercicio")}
            onChange={(v) => form.setValue("exercicio", v, { shouldDirty: true })}
            opcoes={opcoes.exercicios.map((ex) => ({ value: ex, label: ex }))}
            placeholder="Todos"
            buscaPlaceholder="Buscar exercício…"
            vazio="Nenhum exercício encontrado."
            larguraPopover="w-[200px]"
          />
        </Field>

        <Field label="Credor">
          <MultiSelect
            value={form.watch("credor")}
            onChange={(v) => form.setValue("credor", v, { shouldDirty: true })}
            opcoes={opcoes.credores.map((c) => ({ value: c, label: c }))}
            placeholder="Todos os credores"
            buscaPlaceholder="Buscar credor…"
            vazio="Nenhum credor encontrado."
          />
        </Field>

        <Field label="Elemento de despesa">
          <MultiSelect
            value={form.watch("elemento")}
            onChange={(v) => form.setValue("elemento", v, { shouldDirty: true })}
            opcoes={opcoes.elementos.map((e) => ({
              value: e.codigo,
              label: e.descricao,
              hint: e.codigo,
            }))}
            placeholder="Todos os elementos"
            buscaPlaceholder="Buscar elemento…"
            vazio="Nenhum elemento encontrado."
          />
        </Field>

        <Field label="Fonte de recursos">
          <MultiSelect
            value={form.watch("fonte")}
            onChange={(v) => form.setValue("fonte", v, { shouldDirty: true })}
            opcoes={opcoes.fontes.map((f) => ({
              value: f.codigo,
              label: f.descricao,
              hint: f.codigo,
            }))}
            placeholder="Todas as fontes"
            buscaPlaceholder="Buscar fonte…"
            vazio="Nenhuma fonte encontrada."
          />
        </Field>

        <Field label="Tipo">
          <MultiSelect
            value={form.watch("tipo")}
            onChange={(v) => form.setValue("tipo", v, { shouldDirty: true })}
            opcoes={opcoes.tipos.map((t) => ({ value: t, label: t }))}
            placeholder="Todos"
            buscaPlaceholder="Buscar tipo…"
            vazio="Nenhum tipo encontrado."
            larguraPopover="w-[220px]"
          />
        </Field>

        {/* De/Até formam um intervalo só — ficam sob um rótulo único. */}
        <Field label="Emissão" className="col-span-2 md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Emissão — data inicial"
              className={dateInputCls}
              value={form.watch("dataInicio")}
              min={opcoes.dataMin}
              max={opcoes.dataMax}
              onChange={(e) => form.setValue("dataInicio", e.target.value, { shouldDirty: true })}
            />
            <span className="shrink-0 text-xs text-muted-foreground">até</span>
            <input
              type="date"
              aria-label="Emissão — data final"
              className={dateInputCls}
              value={form.watch("dataFim")}
              min={opcoes.dataMin}
              max={opcoes.dataMax}
              onChange={(e) => form.setValue("dataFim", e.target.value, { shouldDirty: true })}
            />
          </div>
        </Field>
      </div>

      {/* Zona 2: resultado da filtragem + ações. Separada da zona de entrada. */}
      <div className="flex items-end justify-between gap-4 border-t pt-3 xl:shrink-0 xl:justify-start xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
        <div className="flex items-end gap-4">
          <Kpi
            icon={Users}
            label={pagina === "risco" ? "Credores em Risco" : "Credores"}
            value={pagina === "risco" ? risco.qtdCredoresRisco : totais.qtdCredores}
          />
          <Kpi
            icon={FileText}
            label={pagina === "risco" ? "Empenhos em Risco" : "Empenhos"}
            value={pagina === "risco" ? risco.qtdEmRisco : totais.qtdEmpenhos}
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <FiltrosAtivosBadge valores={valores} />
          <Button type="button" variant="outline" size="sm" onClick={limpar}>
            <RotateCcw className="h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>
    </form>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex h-9 items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  // <div>, não <label>: os controles são um botão (combobox) ou um par de inputs —
  // em nenhum dos casos um label envolvente aponta para um alvo único.
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
