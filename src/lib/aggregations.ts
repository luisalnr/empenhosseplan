import type { Empenho, Filtros, Totais } from "./types";

export function filtrarEmpenhos(empenhos: Empenho[], f: Filtros): Empenho[] {
  const inicio = f.dataInicio || "";
  const fim = f.dataFim || "";
  return empenhos.filter((e) => {
    if (f.credor.length && !f.credor.includes(e.credor)) return false;
    if (f.elemento.length && !f.elemento.includes(e.elemento.codigo)) return false;
    if (f.fonte.length && !f.fonte.includes(e.fonte.codigo)) return false;
    if (f.classe.length && !f.classe.includes(e.classe.codigo)) return false;
    if (f.tipo.length && !f.tipo.includes(e.tipo)) return false;
    if (inicio && e.dataEmissao < inicio) return false;
    if (fim && e.dataEmissao > fim) return false;
    return true;
  });
}

export function calcularTotais(empenhos: Empenho[]): Totais {
  const t: Totais = {
    empenhado: 0,
    anulado: 0,
    liquido: 0,
    liquidado: 0,
    pago: 0,
    aLiquidar: 0,
    qtdEmpenhos: empenhos.length,
    qtdCredores: new Set(empenhos.map((e) => e.credor)).size,
    pctExecucao: 0,
    pctPago: 0,
  };
  for (const e of empenhos) {
    t.empenhado += e.valor;
    t.anulado += e.anulado;
    t.liquidado += e.liquidado;
    t.pago += e.pago;
    t.aLiquidar += e.aLiquidar;
  }
  t.liquido = t.empenhado - t.anulado;
  t.pctExecucao = t.liquido > 0 ? t.liquidado / t.liquido : 0;
  t.pctPago = t.liquidado > 0 ? t.pago / t.liquidado : 0;
  return t;
}

interface Group {
  key: string;
  label: string;
  empenhado: number;
  anulado: number;
  liquidado: number;
  pago: number;
  aLiquidar: number;
  qtd: number;
}

function newGroup(key: string, label: string): Group {
  return { key, label, empenhado: 0, anulado: 0, liquidado: 0, pago: 0, aLiquidar: 0, qtd: 0 };
}

function accumulate(g: Group, e: Empenho) {
  g.empenhado += e.valor;
  g.anulado += e.anulado;
  g.liquidado += e.liquidado;
  g.pago += e.pago;
  g.aLiquidar += e.aLiquidar;
  g.qtd += 1;
}

function sortDesc(groups: Group[]): Group[] {
  return [...groups].sort((a, b) => b.empenhado - a.empenhado);
}

export function porMes(empenhos: Empenho[]) {
  const map = new Map<string, Group & { liquido: number }>();
  for (const e of empenhos) {
    const mes = e.dataEmissao.slice(0, 7);
    if (!mes) continue;
    let g = map.get(mes);
    if (!g) {
      g = { ...newGroup(mes, mes), liquido: 0 };
      map.set(mes, g);
    }
    accumulate(g, e);
    g.liquido += e.valor - e.anulado;
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function porChave(
  empenhos: Empenho[],
  fn: (e: Empenho) => { codigo: string; descricao: string }
) {
  const map = new Map<string, Group>();
  for (const e of empenhos) {
    const { codigo, descricao } = fn(e);
    const key = codigo || "—";
    let g = map.get(key);
    if (!g) {
      g = newGroup(key, descricao || codigo || "—");
      map.set(key, g);
    }
    accumulate(g, e);
  }
  return sortDesc([...map.values()]);
}

export function porElemento(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => e.elemento);
}
export function porFonte(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => e.fonte);
}
export function porCategoria(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => e.categoria);
}
export function porGnd(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => e.gnd);
}
export function porModalidade(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => e.modalidade);
}
export function porTipo(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => ({ codigo: e.tipo, descricao: e.tipo }));
}

export function porClasse(empenhos: Empenho[]) {
  return porChave(empenhos, (e) => e.classe);
}

export function topCredores(empenhos: Empenho[], n = 10) {
  const map = new Map<string, Group>();
  for (const e of empenhos) {
    const key = e.credor || "—";
    let g = map.get(key);
    if (!g) {
      g = newGroup(key, key);
      map.set(key, g);
    }
    accumulate(g, e);
  }
  return sortDesc([...map.values()]).slice(0, n);
}

export function opcoesDeFiltro(empenhos: Empenho[]) {
  const credores = [...new Set(empenhos.map((e) => e.credor).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const elementos = [
    ...new Map(empenhos.map((e) => [e.elemento.codigo, e.elemento])).values(),
  ]
    .filter((r) => r.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const fontes = [...new Map(empenhos.map((e) => [e.fonte.codigo, e.fonte])).values()]
    .filter((r) => r.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const classes = [...new Map(empenhos.map((e) => [e.classe.codigo, e.classe])).values()]
    .filter((r) => r.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const tipos = [...new Set(empenhos.map((e) => e.tipo).filter(Boolean))].sort();
  const datas = empenhos.map((e) => e.dataEmissao).filter(Boolean).sort();
  return {
    credores,
    elementos,
    fontes,
    classes,
    tipos,
    dataMin: datas[0] || "",
    dataMax: datas[datas.length - 1] || "",
  };
}
