import type { Checagem, Empenho, FaseDespesa } from "./types";
import { calcularRiscos, agregarRisco } from "./risco";
import { COLUNAS_EMPENHO } from "./parser";
import { COLUNAS_LIQUIDACAO, COLUNAS_PAGAMENTO } from "./parser-fases";

const EPS = 0.005;
const TOL_REL = 0.05; // 5%

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
    const orfas = liquidacoes.filter((l) => !empSet.has(l.numeroEmpenho));
    checks.push({
      id: "liq-sem-emp",
      label: "Liquidações vinculadas a empenho",
      status: orfas.length === 0 ? "ok" : orfas.length / liquidacoes.length > 0.1 ? "erro" : "aviso",
      detalhe:
        orfas.length === 0
          ? `Todas as ${liquidacoes.length.toLocaleString("pt-BR")} liquidações têm empenho correspondente`
          : `${orfas.length.toLocaleString("pt-BR")} liquidações sem empenho correspondente`,
      count: orfas.length,
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
    const orfas = pagamentos.filter((p) => !empSet.has(p.numeroEmpenho));
    checks.push({
      id: "pag-sem-emp",
      label: "Pagamentos vinculados a empenho",
      status: orfas.length === 0 ? "ok" : orfas.length / pagamentos.length > 0.1 ? "erro" : "aviso",
      detalhe:
        orfas.length === 0
          ? `Todos os ${pagamentos.length.toLocaleString("pt-BR")} pagamentos têm empenho correspondente`
          : `${orfas.length.toLocaleString("pt-BR")} pagamentos sem empenho correspondente`,
      count: orfas.length,
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
