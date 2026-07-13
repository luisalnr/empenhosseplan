import type { Empenho, RiscoEmpenho, RiscoAgregado } from "./types";

const EPS = 0.005;

export function calcularRiscoEmpenho(e: Empenho): RiscoEmpenho {
  const liquido = e.valor - e.anulado;
  const saldoExecutar = e.valor + e.complemento - e.anulado;
  const aLiquidar = Math.max(0, saldoExecutar - e.liquidado);
  const aPagar = Math.max(0, e.liquidado - e.pago);
  const temNP = aLiquidar > EPS;
  const temP = aPagar > EPS;
  const tipoRisco: RiscoEmpenho["tipoRisco"] = temNP ? "np" : temP ? "p" : null;

  return {
    numero: e.numero,
    credor: e.credor,
    dataEmissao: e.dataEmissao,
    tipo: e.tipo,
    descricao: e.descricao,
    elemento: e.elemento,
    fonte: e.fonte,
    liquido,
    liquidado: e.liquidado,
    aLiquidar,
    pago: e.pago,
    aPagar,
    tipoRisco,
  };
}

export function calcularRiscos(empenhos: Empenho[]): RiscoEmpenho[] {
  return empenhos.map(calcularRiscoEmpenho);
}

export function agregarRisco(riscos: RiscoEmpenho[]): RiscoAgregado {
  let valorRNP = 0;
  let valorRP = 0;
  let qtdNP = 0;
  let qtdP = 0;
  let qtdEmRisco = 0;
  let empenhadoLiquido = 0;
  let liquidado = 0;
  const credoresRisco = new Set<string>();

  for (const r of riscos) {
    empenhadoLiquido += r.liquido;
    liquidado += r.liquidado;
    if (r.aLiquidar > EPS) {
      valorRNP += r.aLiquidar;
      qtdNP += 1;
      qtdEmRisco += 1;
      credoresRisco.add(r.credor || "—");
    } else if (r.aPagar > EPS) {
      valorRP += r.aPagar;
      qtdP += 1;
      qtdEmRisco += 1;
      credoresRisco.add(r.credor || "—");
    }
  }

  const pctRNP = empenhadoLiquido > 0 ? valorRNP / empenhadoLiquido : 0;
  const pctRP = liquidado > 0 ? valorRP / liquidado : 0;

  return {
    valorRNP,
    valorRP,
    qtdNP,
    qtdP,
    qtdEmRisco,
    qtdCredoresRisco: credoresRisco.size,
    pctRNP,
    pctRP,
  };
}

export interface RiscoPorCredor {
  credor: string;
  valorRNP: number;
  valorRP: number;
  valorTotal: number;
  qtd: number;
}

export function riscoPorCredor(riscos: RiscoEmpenho[], n = 10): RiscoPorCredor[] {
  const map = new Map<string, RiscoPorCredor>();
  for (const r of riscos) {
    if (r.tipoRisco === null) continue;
    const key = r.credor || "—";
    let g = map.get(key);
    if (!g) {
      g = { credor: key, valorRNP: 0, valorRP: 0, valorTotal: 0, qtd: 0 };
      map.set(key, g);
    }
    if (r.tipoRisco === "np") g.valorRNP += r.aLiquidar;
    else g.valorRP += r.aPagar;
    g.valorTotal = g.valorRNP + g.valorRP;
    g.qtd += 1;
  }
  return [...map.values()].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, n);
}
