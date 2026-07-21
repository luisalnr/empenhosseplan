"use client";
import * as React from "react";
import type {
  Empenho,
  Filtros,
  MtoData,
  Pagina,
  Totais,
  RiscoAgregado,
  FaseDespesa,
  ResultadoImportacao,
  PeriodoAnalise,
} from "@/lib/types";
import { loadMto } from "@/lib/mto";
import { filtrosVazios } from "@/lib/filters";
import {
  getAllEmpenhos,
  seedIfEmpty,
  upsertEmpenhos,
  replaceAllEmpenhos,
  usandoNeon,
} from "@/lib/data/repository";
import {
  saveLiquidacoes,
  savePagamentos,
  getLiquidacoes,
  getPagamentos,
  seedFasesIfEmpty,
} from "@/lib/data/fases-repository";
import { parseSicafXlsx } from "@/lib/parser";
import { parseLiquidacoesXlsx, parsePagamentosXlsx } from "@/lib/parser-fases";
import { invalidateFasesCache } from "@/lib/fases";
import {
  filtrarEmpenhos,
  calcularTotais,
  opcoesDeFiltro,
} from "@/lib/aggregations";
import { calcularRiscos, agregarRisco } from "@/lib/risco";
import { exercicioMaisRecente, exerciciosDe } from "@/lib/exercicio";
import {
  loadPeriodoSeed,
  loadPeriodosServer,
  loadPeriodosStored,
  periodoDosExercicios,
  periodoFromEmpenhos,
  periodosFromEmpenhos,
  savePeriodoStored,
  savePeriodosServer,
  type PeriodosPorExercicio,
} from "@/lib/periodo";
import type { FiltrosForm } from "@/lib/filters";

interface Opcoes {
  exercicios: string[];
  credores: string[];
  elementos: { codigo: string; descricao: string }[];
  fontes: { codigo: string; descricao: string }[];
  classes: { codigo: string; descricao: string }[];
  tipos: string[];
  dataMin: string;
  dataMax: string;
}

export interface ImportarTudoArgs {
  empenho?: Blob | null;
  liquidacao?: Blob | null;
  pagamento?: Blob | null;
  mode?: "merge" | "replace";
}

interface DashboardContextValue {
  empenhos: Empenho[];
  filtered: Empenho[];
  totais: Totais;
  risco: RiscoAgregado;
  opcoes: Opcoes;
  filtros: Filtros;
  /** Estado inicial dos filtros: exercício mais recente selecionado. */
  filtrosPadrao: Filtros;
  setFiltros: (f: Partial<FiltrosForm>) => void;
  limparFiltros: () => void;
  mto: MtoData | null;
  loading: boolean;
  error: string | null;
  pagina: Pagina;
  setPagina: (p: Pagina) => void;
  /** @deprecated preferir importarTudo na aba Importação */
  importar: (file: Blob, mode: "merge" | "replace") => Promise<number>;
  importarTudo: (args: ImportarTudoArgs) => Promise<ResultadoImportacao[]>;
  liquidacoes: FaseDespesa[];
  pagamentos: FaseDespesa[];
  ultimaAtualizacao: string | null;
  /** Período declarado nos relatórios WW (topo da planilha). */
  periodoAnalise: PeriodoAnalise | null;
  /** false = modo demo: as importações ficam só neste navegador (IndexedDB). */
  persistindoNoBanco: boolean;
}

const DashboardContext = React.createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = React.useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard deve ser usado dentro de DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [empenhos, setEmpenhos] = React.useState<Empenho[]>([]);
  const [liquidacoes, setLiquidacoes] = React.useState<FaseDespesa[]>([]);
  const [pagamentos, setPagamentos] = React.useState<FaseDespesa[]>([]);
  const [mto, setMto] = React.useState<MtoData | null>(null);
  const [filtros, setFiltrosState] = React.useState<Filtros>(filtrosVazios);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState<Pagina>("sintese");
  const [ultimaAtualizacao, setUltima] = React.useState<string | null>(null);
  const [periodos, setPeriodos] = React.useState<PeriodosPorExercicio>({});
  const [persistindoNoBanco, setPersistindoNoBanco] = React.useState(true);

  const carregar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await loadMto();
      setMto(m);
      const neon = await usandoNeon();
      setPersistindoNoBanco(neon);
      await seedIfEmpty();
      await seedFasesIfEmpty();
      const [dados, liq, pag] = await Promise.all([
        getAllEmpenhos(),
        getLiquidacoes(),
        getPagamentos(),
      ]);
      setEmpenhos(dados);
      setLiquidacoes(liq);
      setPagamentos(pag);
      setUltima(new Date().toLocaleString("pt-BR"));
      // Período do exercício, do menos para o mais confiável: emissões dos empenhos
      // → relatório que gerou o seed → período declarado gravado no import. Este último
      // vive no servidor (Neon) quando há banco — igual em toda máquina — ou no cache
      // local só no modo demo.
      const mapa = periodosFromEmpenhos(dados);
      const seed = await loadPeriodoSeed();
      if (seed) mapa[seed.inicio.slice(0, 4)] = seed;
      const declarados = neon ? await loadPeriodosServer() : loadPeriodosStored();
      setPeriodos({ ...mapa, ...declarados });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    carregar();
  }, [carregar]);

  // O exercício é seleção única e sempre tem um valor: somar exercícios distintos
  // nos KPIs e no painel de Risco (restos a pagar) não tem sentido contábil.
  const filtrosPadrao = React.useMemo<Filtros>(
    () => ({ ...filtrosVazios, exercicio: exercicioMaisRecente(empenhos) ?? "" }),
    [empenhos]
  );

  const padraoAplicado = React.useRef(false);
  React.useEffect(() => {
    if (padraoAplicado.current || !filtrosPadrao.exercicio) return;
    padraoAplicado.current = true;
    setFiltrosState(filtrosPadrao);
  }, [filtrosPadrao]);

  const setFiltros = React.useCallback((f: Partial<FiltrosForm>) => {
    setFiltrosState((prev) => ({ ...prev, ...f }));
  }, []);

  const limparFiltros = React.useCallback(() => {
    setFiltrosState({ ...filtrosPadrao });
  }, [filtrosPadrao]);

  /**
   * Registra o período dos exercícios que acabaram de ser importados, sem tocar nos
   * demais. O período declarado no relatório vale para todos os exercícios do arquivo;
   * na falta dele, cada exercício cai no intervalo de emissão dos próprios registros.
   */
  const registrarPeriodo = React.useCallback(
    (records: Empenho[], declarado: PeriodoAnalise | null) => {
      const novos: PeriodosPorExercicio = {};
      for (const ex of exerciciosDe(records)) {
        const p =
          declarado ?? periodoFromEmpenhos(records.filter((r) => r.exercicio === ex));
        if (!p) continue;
        novos[ex] = p;
      }
      if (!Object.keys(novos).length) return;
      // Persiste onde os dados vivem: no banco (mesmo período para todos) ou, no modo
      // demo, no cache local deste navegador.
      if (persistindoNoBanco) {
        void savePeriodosServer(novos);
      } else {
        for (const [ex, p] of Object.entries(novos)) savePeriodoStored(ex, p);
      }
      setPeriodos((prev) => ({ ...prev, ...novos }));
    },
    [persistindoNoBanco]
  );

  const importar = React.useCallback(
    async (file: Blob, mode: "merge" | "replace") => {
      if (!mto) throw new Error("Dados de referência (MTO) ainda carregando");
      const { records, periodo } = await parseSicafXlsx(file, mto);
      if (records.length === 0) throw new Error("Nenhum registro válido encontrado na planilha");
      if (mode === "replace") await replaceAllEmpenhos(records);
      else await upsertEmpenhos(records);
      const dados = await getAllEmpenhos();
      setEmpenhos(dados);
      setUltima(new Date().toLocaleString("pt-BR"));
      registrarPeriodo(records, periodo);
      return records.length;
    },
    [mto, registrarPeriodo]
  );

  const importarTudo = React.useCallback(
    async ({ empenho, liquidacao, pagamento, mode = "replace" }: ImportarTudoArgs) => {
      if (!empenho && !liquidacao && !pagamento) {
        throw new Error("Selecione ao menos um arquivo para importar");
      }
      if (empenho && !mto) {
        throw new Error("Dados de referência (MTO) ainda carregando");
      }

      const resultados: ResultadoImportacao[] = [];
      let periodoDetectado: PeriodoAnalise | null = null;
      let empenhosImportados: Empenho[] = [];

      if (empenho) {
        try {
          const { records, periodo } = await parseSicafXlsx(empenho, mto!);
          if (periodo) periodoDetectado = periodo;
          empenhosImportados = records;
          if (records.length === 0) {
            resultados.push({
              tipo: "empenho",
              ok: false,
              registros: 0,
              erros: ["Nenhum registro válido encontrado na planilha de empenhos"],
              avisos: [],
            });
          } else {
            if (mode === "replace") await replaceAllEmpenhos(records);
            else await upsertEmpenhos(records);
            resultados.push({
              tipo: "empenho",
              ok: true,
              registros: records.length,
              erros: [],
              avisos: [],
            });
          }
        } catch (e) {
          resultados.push({
            tipo: "empenho",
            ok: false,
            registros: 0,
            erros: [e instanceof Error ? e.message : "Falha ao importar empenhos"],
            avisos: [],
          });
        }
      }

      if (liquidacao) {
        try {
          const { records, periodo } = await parseLiquidacoesXlsx(liquidacao);
          if (periodo && !periodoDetectado) periodoDetectado = periodo;
          if (records.length === 0) {
            resultados.push({
              tipo: "liquidacao",
              ok: false,
              registros: 0,
              erros: ["Nenhum registro válido encontrado na planilha de liquidações"],
              avisos: [],
            });
          } else {
            await saveLiquidacoes(records, mode);
            resultados.push({
              tipo: "liquidacao",
              ok: true,
              registros: records.length,
              erros: [],
              avisos: [],
            });
          }
        } catch (e) {
          resultados.push({
            tipo: "liquidacao",
            ok: false,
            registros: 0,
            erros: [e instanceof Error ? e.message : "Falha ao importar liquidações"],
            avisos: [],
          });
        }
      }

      if (pagamento) {
        try {
          const { records, periodo } = await parsePagamentosXlsx(pagamento);
          if (periodo && !periodoDetectado) periodoDetectado = periodo;
          if (records.length === 0) {
            resultados.push({
              tipo: "pagamento",
              ok: false,
              registros: 0,
              erros: ["Nenhum registro válido encontrado na planilha de pagamentos"],
              avisos: [],
            });
          } else {
            await savePagamentos(records, mode);
            resultados.push({
              tipo: "pagamento",
              ok: true,
              registros: records.length,
              erros: [],
              avisos: [],
            });
          }
        } catch (e) {
          resultados.push({
            tipo: "pagamento",
            ok: false,
            registros: 0,
            erros: [e instanceof Error ? e.message : "Falha ao importar pagamentos"],
            avisos: [],
          });
        }
      }

      invalidateFasesCache();
      const [dados, liq, pag] = await Promise.all([
        getAllEmpenhos(),
        getLiquidacoes(),
        getPagamentos(),
      ]);
      setEmpenhos(dados);
      setLiquidacoes(liq);
      setPagamentos(pag);
      setUltima(new Date().toLocaleString("pt-BR"));

      // Só os exercícios efetivamente importados têm o período reescrito.
      registrarPeriodo(empenhosImportados, periodoDetectado);

      return resultados;
    },
    [mto, registrarPeriodo]
  );

  // O cabeçalho mostra o período do exercício selecionado, não um valor global.
  const periodoAnalise = React.useMemo(
    () => periodoDosExercicios(periodos, filtros.exercicio ? [filtros.exercicio] : []),
    [periodos, filtros.exercicio]
  );

  const filtered = React.useMemo(() => filtrarEmpenhos(empenhos, filtros), [empenhos, filtros]);
  const totais = React.useMemo(() => calcularTotais(filtered), [filtered]);
  const risco = React.useMemo(() => agregarRisco(calcularRiscos(filtered)), [filtered]);
  const opcoes = React.useMemo(() => opcoesDeFiltro(empenhos), [empenhos]);

  const value: DashboardContextValue = {
    empenhos,
    filtered,
    totais,
    risco,
    opcoes,
    filtros,
    filtrosPadrao,
    setFiltros,
    limparFiltros,
    mto,
    loading,
    error,
    pagina,
    setPagina,
    importar,
    importarTudo,
    liquidacoes,
    pagamentos,
    ultimaAtualizacao,
    periodoAnalise,
    persistindoNoBanco,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
