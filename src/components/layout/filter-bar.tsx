"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Filter, RotateCcw, Users, FileText } from "lucide-react";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { filtrosSchema, type FiltrosForm, filtrosVazios } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function FiltrosAtivosBadge({ valores }: { valores: FiltrosForm }) {
  const n = (["credor", "elemento", "fonte", "tipo", "dataInicio", "dataFim"] as const).filter(
    (k) => valores[k]
  ).length;
  if (!n) return null;
  return <Badge variant="secondary" className="ml-1">{n} ativo{n > 1 ? "s" : ""}</Badge>;
}

function CredorCombobox({
  value,
  onChange,
  credores,
}: {
  value: string;
  onChange: (v: string) => void;
  credores: string[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Todos os credores"}
          </span>
          <Filter className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar credor…" />
          <CommandList>
            <CommandEmpty>Nenhum credor encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted-foreground"
              >
                <Check className={cn("mr-2 h-4 w-4", !value && "opacity-100", value && "opacity-0")} />
                Todos os credores
              </CommandItem>
              {credores.map((c) => (
                <CommandItem
                  key={c}
                  onSelect={() => {
                    onChange(c === value ? "" : c);
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

export function FilterBar() {
  const { opcoes, setFiltros, limparFiltros, totais, risco, pagina } = useDashboard();

  const form = useForm<FiltrosForm>({
    resolver: zodResolver(filtrosSchema),
    defaultValues: filtrosVazios,
    mode: "onChange",
  });

  const valores = form.watch();
  const [resetKey, setResetKey] = React.useState(0);
  // Assinatura event-driven: só propaga ao contexto quando o formulário muda de fato.
  React.useEffect(() => {
    const sub = form.watch((data) => {
      setFiltros({
        credor: data.credor ?? "",
        elemento: data.elemento ?? "",
        fonte: data.fonte ?? "",
        tipo: data.tipo ?? "",
        dataInicio: data.dataInicio ?? "",
        dataFim: data.dataFim ?? "",
      });
    });
    return () => sub.unsubscribe();
  }, [form, setFiltros]);

  const limpar = () => {
    form.reset({ ...filtrosVazios });
    limparFiltros();
    setResetKey((k) => k + 1);
  };

  return (
    <form key={resetKey} className="flex flex-wrap items-end gap-2 px-4 py-3 sm:px-6">
      <Field label="Credor" className="w-full sm:w-72">
        <CredorCombobox
          value={form.watch("credor")}
          onChange={(v) => form.setValue("credor", v, { shouldDirty: true })}
          credores={opcoes.credores}
        />
      </Field>

      <Field label="Elemento de despesa" className="w-full sm:w-64">
        <Select
          value={form.watch("elemento")}
          onValueChange={(v) => form.setValue("elemento", v === "__all" ? "" : v, { shouldDirty: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos os elementos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os elementos</SelectItem>
            {opcoes.elementos.map((e) => (
              <SelectItem key={e.codigo} value={e.codigo}>
                <span className="text-muted-foreground">{e.codigo}</span> — {e.descricao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Fonte de recursos" className="w-full sm:w-64">
        <Select
          value={form.watch("fonte")}
          onValueChange={(v) => form.setValue("fonte", v === "__all" ? "" : v, { shouldDirty: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas as fontes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as fontes</SelectItem>
            {opcoes.fontes.map((f) => (
              <SelectItem key={f.codigo} value={f.codigo}>
                <span className="text-muted-foreground">{f.codigo}</span> — {f.descricao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Tipo" className="w-36">
        <Select
          value={form.watch("tipo")}
          onValueChange={(v) => form.setValue("tipo", v === "__all" ? "" : v, { shouldDirty: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos</SelectItem>
            {opcoes.tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="De" className="w-40">
        <input
          type="date"
          className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
          value={form.watch("dataInicio")}
          min={opcoes.dataMin}
          max={opcoes.dataMax}
          onChange={(e) => form.setValue("dataInicio", e.target.value, { shouldDirty: true })}
        />
      </Field>

      <Field label="Até" className="w-40">
        <input
          type="date"
          className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
          value={form.watch("dataFim")}
          min={opcoes.dataMin}
          max={opcoes.dataMax}
          onChange={(e) => form.setValue("dataFim", e.target.value, { shouldDirty: true })}
        />
      </Field>

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {pagina === "risco" ? "Credores em Risco" : "Credores"}
          </span>
          <span className="flex h-9 items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-muted-foreground" />
            {(pagina === "risco" ? risco.qtdCredoresRisco : totais.qtdCredores).toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {pagina === "risco" ? "Empenhos em Risco" : "Empenhos"}
          </span>
          <span className="flex h-9 items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {(pagina === "risco" ? risco.qtdEmRisco : totais.qtdEmpenhos).toLocaleString("pt-BR")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pb-0.5 ml-auto">
        <FiltrosAtivosBadge valores={valores} />
        <Button type="button" variant="outline" size="sm" onClick={limpar}>
          <RotateCcw className="h-4 w-4" /> Limpar
        </Button>
      </div>
    </form>
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
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
