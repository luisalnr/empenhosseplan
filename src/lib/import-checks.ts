import type { Checagem, Empenho, FaseDespesa } from "./types";
import { calcularRiscos, agregarRisco } from "./risco";
import { COLUNAS_EMPENHO } from "./parser";
import { COLUNAS_LIQUIDACAO, COLUNAS_PAGAMENTO } from "./parser-fases";
import { exercicioDe } from "./exercicio";

const EPS = 0.005;
const TOL_REL = 0.05; // 5%
const MAX_ITENS = 50; // amostra exibida no drill-down

/**
 * Fases sem empenho correspondente, separadas por causa:
 *
 * - `restos`: o empenho é de um exercício que não está carregado. É o caso normal de
 *   restos a pagar — empenho inscrito num ano e liquidado/pago no seguinte. Esperado.
 * - `reais`: o exercício está carregado, mas aquele número não existe nele. Aí sim há
 *   um problema de dados (número divergente, planilha incompleta).
 */
function classificarOrfas(
  fases: FaseDespesa[],
  empSet: Set<string>,
  exerciciosCarregados: Set<string>
): { restos: FaseDespesa[]; reais: FaseDespesa[] } {
  const restos: FaseDespesa[] = [];
  const reais: FaseDespesa[] = [];
  for (const f of fases) {
    if (empSet.has(f.numeroEmpenho)) continue;
    if (exerciciosCarregados.has(exercicioDe(f.numeroEmpenho))) reais.push(f);
    else restos.push(f);
  }
  return { restos, reais };
}

/** Amostra de números de empenho citados pelas fases, sem repetição. */
function amostraEmpenhos(fases: FaseDespesa[]): string[] {
  return [...new Set(fases.map((f) => f.numeroEmpenho))].slice(0, MAX_ITENS);
}

export interface DadosChecagem {
  empenhos: Empenho[];
  liquidacoes: FaseDespesa[];
  pagamentos: FaseDespesa[];
  colunasEmpenho?: Record<string, boolean> | null;
  colunasLiquidacao?: Record<string, boolean> | null;
  colunasPagamento?: Record<string, boolean> | null;
  /** Se false, a checagem de colunas daquele arquivo fica pendente. */
  temArquivoEmpenho?: boolean;
  temArquivoLiquidacao?: boolean;
  temArquivoPagamento?: boolean;
}

function colunasStatus(
  id: string,
  label: string,
  esperadas: string[],
  encontradas: Record<string, boolean> | null | undefined,
  temArquivo: boolean | undefined,
  temDadosPersistidos: boolean
): Checagem {
  if (encontradas) {
    const faltando = esperadas.filter((c) => !encontradas[c]);
    if (faltando.length === 0) {
      return {
        id,
        label,
        status: "ok",
        detalhe: `Todas as ${esperadas.length} colunas obrigatórias presentes`,
        count: esperadas.length,
      };
    }
    return {
      id,
      label,
      status: "erro",
      detalhe: `Faltando: ${faltando.join(", ")}`,
      count: faltando.length,
    };
  }
  if (temArquivo) {
    return {
      id,
      label,
      status: "pendente",
      detalhe: "Aguardando análise do arquivo",
    };
  }
  if (temDadosPersistidos) {
    return {
      id,
      label,
      status: "ok",
      detalhe: "Dados já carregados na base (colunas validadas na última importação)",
    };
  }
  return {
    id,
    label,
    status: "pendente",
    detalhe: "Arquivo ainda não selecionado",
  };
}

/**
 * Executa as 9 checagens de consistência da aba Importação.
 * Aceita dados já em memória (pós-import) ou prévia de parse (pré-import).
 */
export function executarChecagens(d: DadosChecagem): Checagem[] {
  const {
    empenhos,
    liquidacoes,
    pagamentos,
    colunasEmpenho,
    colunasLiquidacao,
    colunasPagamento,
    temArquivoEmpenho = false,
    temArquivoLiquidacao = false,
    temArquivoPagamento = false,
  } = d;

  const checks: Checagem[] = [];

  // 1. Colunas empenho
  checks.push(
    colunasStatus(
      "colunas-empenho",
      "Colunas do relatório de empenhos",
      COLUNAS_EMPENHO,
      colunasEmpenho,
      temArquivoEmpenho,
      empenhos.length > 0
    )
  );

  // 2. Colunas liquidação
  checks.push(
    colunasStatus(
      "colunas-liquidacao",
      "Colunas do relatório de liquidações",
      COLUNAS_LIQUIDACAO,
      colunasLiquidacao,
      temArquivoLiquidacao,
      liquidacoes.length > 0
    )
  );

  // 3. Colunas pagamento
  checks.push(
    colunasStatus(
      "colunas-pagamento",
      "Colunas do relatório de pagamentos",
      COLUNAS_PAGAMENTO,
      colunasPagamento,
      temArquivoPagamento,
      pagamentos.length > 0
    )
  );

  // 4. MTO mapeado
  if (empenhos.length === 0) {
    checks.push({
      id: "mto",
      label: "Mapeamento MTO (elemento/fonte/classe)",
      status: "pendente",
      detalhe: "Sem empenhos para avaliar",
    });
  } else {
    let ok = 0;
    for (const e of empenhos) {
      const mapped =
        Boolean(e.elemento.descricao) &&
        Boolean(e.fonte.descricao) &&
        Boolean(e.classe.descricao || e.classe.codigo);
      if (mapped) ok += 1;
    }
    const pct = ok / empenhos.length;
    checks.push({
      id: "mto",
      label: "Mapeamento MTO (elemento/fonte/classe)",
      status: pct >= 0.9 ? "ok" : pct >= 0.5 ? "aviso" : "erro",
      detalhe: `${ok.toLocaleString("pt-BR")} de ${empenhos.length.toLocaleString("pt-BR")} empenhos com classificação completa (${(pct * 100).toFixed(0)}%)`,
      count: ok,
    });
  }

  const empSet = new Set(empenhos.map((e) => e.numero));
  const exerciciosCarregados = new Set(empenhos.map((e) => e.exercicio).filter(Boolean));
  const orfasLiq = classificarOrfas(liquidacoes, empSet, exerciciosCarregados);
  const orfasPag = classificarOrfas(pagamentos, empSet, exerciciosCarregados);

  // 5. Liquidações sem empenho
  if (liquidacoes.length === 0) {
    checks.push({
      id: "liq-sem-emp",
      label: "Liquidações vinculadas a empenho",
      status: empenhos.length === 0 ? "pendente" : "aviso",
      detalhe:
        empenhos.length === 0
          ? "Sem liquidações carregadas"
          : "Nenhuma liquidação carregada",
    });
  } else if (empenhos.length === 0) {
    checks.push({
      id: "liq-sem-emp",
      label: "Liquidações vinculadas a empenho",
      status: "aviso",
      detalhe: "Empenhos ainda não carregados para cruzamento",
      count: liquidacoes.length,
    });
  } else {
    // Restos a pagar ficam fora desta conta — são reportados na checagem própria.
    const reais = orfasLiq.reais;
    checks.push({
      id: "liq-sem-emp",
      label: "Liquidações vinculadas a empenho",
      status: reais.length === 0 ? "ok" : reais.length / liquidacoes.length > 0.1 ? "erro" : "aviso",
      detalhe:
        reais.length === 0
          ? `Todas as ${liquidacoes.length.toLocaleString("pt-BR")} liquidações têm empenho correspondente`
          : `${reais.length.toLocaleString("pt-BR")} liquidações apontam para empenhos inexistentes no exercício carregado`,
      count: reais.length,
      itens: amostraEmpenhos(reais),
    });
  }

  // 6. Pagamentos sem empenho
  if (pagamentos.length === 0) {
    checks.push({
      id: "pag-sem-emp",
      label: "Pagamentos vinculados a empenho",
      status: empenhos.length === 0 ? "pendente" : "aviso",
      detalhe:
        empenhos.length === 0
          ? "Sem pagamentos carregados"
          : "Nenhum pagamento carregado",
    });
  } else if (empenhos.length === 0) {
    checks.push({
      id: "pag-sem-emp",
      label: "Pagamentos vinculados a empenho",
      status: "aviso",
      detalhe: "Empenhos ainda não carregados para cruzamento",
      count: pagamentos.length,
    });
  } else {
    const reais = orfasPag.reais;
    checks.push({
      id: "pag-sem-emp",
      label: "Pagamentos vinculados a empenho",
      status: reais.length === 0 ? "ok" : reais.length / pagamentos.length > 0.1 ? "erro" : "aviso",
      detalhe:
        reais.length === 0
          ? `Todos os ${pagamentos.length.toLocaleString("pt-BR")} pagamentos têm empenho correspondente`
          : `${reais.length.toLocaleString("pt-BR")} pagamentos apontam para empenhos inexistentes no exercício carregado`,
      count: reais.length,
      itens: amostraEmpenhos(reais),
    });
  }

  // Restos a pagar: fases de exercícios anteriores não carregados. Informativo — é o
  // fluxo normal de um empenho inscrito em RAP e liquidado/pago no exercício seguinte.
  const restos = [...orfasLiq.restos, ...orfasPag.restos];
  if (restos.length) {
    const anos = [...new Set(restos.map((f) => exercicioDe(f.numeroEmpenho)).filter(Boolean))].sort();
    const partes: string[] = [];
    if (orfasLiq.restos.length) {
      partes.push(`${orfasLiq.restos.length.toLocaleString("pt-BR")} liquidações`);
    }
    if (orfasPag.restos.length) {
      partes.push(`${orfasPag.restos.length.toLocaleString("pt-BR")} pagamentos`);
    }
    checks.push({
      id: "restos-a-pagar",
      label: "Restos a pagar (exercícios anteriores)",
      status: "ok",
      detalhe:
        `${partes.join(" e ")} referem-se a empenhos de ${anos.join(", ")}, não carregados. ` +
        `Esperado: empenhos inscritos em restos a pagar são liquidados/pagos no exercício seguinte. ` +
        `Importe o${anos.length > 1 ? "s" : ""} exercício${anos.length > 1 ? "s" : ""} ${anos.join(", ")} para cruzá-los.`,
      count: restos.length,
      itens: amostraEmpenhos(restos),
    });
  }

  // 7. Empenhos com liquidado > 0 sem liquidação correspondente
  if (empenhos.length === 0) {
    checks.push({
      id: "emp-sem-liq",
      label: "Empenhos liquidados com relatório de liquidação",
      status: "pendente",
      detalhe: "Sem empenhos para avaliar",
    });
  } else if (liquidacoes.length === 0) {
    const comLiq = empenhos.filter((e) => e.liquidado > EPS).length;
    checks.push({
      id: "emp-sem-liq",
      label: "Empenhos liquidados com relatório de liquidação",
      status: comLiq > 0 ? "aviso" : "pendente",
      detalhe:
        comLiq > 0
          ? `${comLiq.toLocaleString("pt-BR")} empenhos com valor liquidado, mas sem relatório de liquidações`
          : "Sem liquidações carregadas",
      count: comLiq,
    });
  } else {
    const liqPorEmp = new Set(liquidacoes.map((l) => l.numeroEmpenho));
    const sem = empenhos.filter((e) => e.liquidado > EPS && !liqPorEmp.has(e.numero));
    checks.push({
      id: "emp-sem-liq",
      label: "Empenhos liquidados com relatório de liquidação",
      status: sem.length === 0 ? "ok" : "aviso",
      detalhe:
        sem.length === 0
          ? "Todos os empenhos com liquidado > 0 têm liquidação no relatório"
          : `${sem.length.toLocaleString("pt-BR")} empenhos com liquidado > 0 sem liquidação correspondente`,
      count: sem.length,
    });
  }

  // 8. Consistência: soma liquidações ≈ liquidado do empenho (tol. 5%)
  if (empenhos.length === 0 || liquidacoes.length === 0) {
    checks.push({
      id: "consist-liq",
      label: "Consistência liquidado × soma das liquidações",
      status: "pendente",
      detalhe: "Necessário empenhos e liquidações",
    });
  } else {
    const somaPorEmp = new Map<string, number>();
    for (const l of liquidacoes) {
      const st = (l.status || "").toLowerCase();
      // ignora cancelados/anulados se status indicar isso
      if (st.includes("cancel") || st.includes("anul")) continue;
      somaPorEmp.set(l.numeroEmpenho, (somaPorEmp.get(l.numeroEmpenho) || 0) + l.valor);
    }
    let divergentes = 0;
    let comparados = 0;
    for (const e of empenhos) {
      if (e.liquidado <= EPS && !somaPorEmp.has(e.numero)) continue;
      const soma = somaPorEmp.get(e.numero) || 0;
      if (e.liquidado <= EPS && soma <= EPS) continue;
      comparados += 1;
      const base = Math.max(e.liquidado, soma, EPS);
      if (Math.abs(e.liquidado - soma) / base > TOL_REL) divergentes += 1;
    }
    checks.push({
      id: "consist-liq",
      label: "Consistência liquidado × soma das liquidações",
      status:
        comparados === 0
          ? "pendente"
          : divergentes === 0
            ? "ok"
            : divergentes / comparados > 0.2
              ? "erro"
              : "aviso",
      detalhe:
        comparados === 0
          ? "Nenhum empenho com valores para comparar"
          : divergentes === 0
            ? `${comparados.toLocaleString("pt-BR")} empenhos com liquidado ≈ soma das liquidações (±5%)`
            : `${divergentes.toLocaleString("pt-BR")} de ${comparados.toLocaleString("pt-BR")} empenhos com divergência > 5%`,
      count: divergentes,
    });
  }

  // 9. Risco calculável
  if (empenhos.length === 0) {
    checks.push({
      id: "risco",
      label: "Risco calculável (RNP / RP)",
      status: "pendente",
      detalhe: "Sem empenhos para calcular risco",
    });
  } else {
    const risco = agregarRisco(calcularRiscos(empenhos));
    const ok = risco.qtdEmRisco > 0 || (risco.valorRNP === 0 && risco.valorRP === 0);
    checks.push({
      id: "risco",
      label: "Risco calculável (RNP / RP)",
      status: "ok",
      detalhe:
        risco.qtdEmRisco > 0
          ? `${risco.qtdEmRisco.toLocaleString("pt-BR")} empenhos em risco (NP: ${risco.qtdNP}, P: ${risco.qtdP})`
          : "Risco calculado — nenhum empenho com saldo pendente",
      count: risco.qtdEmRisco,
    });
    void ok;
  }

  return checks;
}
