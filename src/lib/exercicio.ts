import type { Empenho } from "./types";

/**
 * Exercício financeiro de um empenho, derivado do sufixo do número
 * ("7130010001/2026" → "2026").
 *
 * O número é a fonte correta, e não a data de emissão: em restos a pagar o
 * empenho pertence ao exercício de origem, mesmo movimentado em anos seguintes.
 * A data só é usada como último recurso, quando o número não traz o sufixo.
 */
export function exercicioDe(numero: string, dataEmissao?: string): string {
  const m = String(numero ?? "").match(/\/(\d{4})\s*$/);
  if (m) return m[1];
  return (dataEmissao ?? "").slice(0, 4);
}

/** Exercícios distintos presentes nos empenhos, do mais recente para o mais antigo. */
export function exerciciosDe(empenhos: Empenho[]): string[] {
  return [...new Set(empenhos.map((e) => e.exercicio).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a)
  );
}

/**
 * Exercícios distintos referenciados por um lote de fases (liquidações/pagamentos),
 * lidos do empenho vinculado. As tabelas de fases não têm coluna de exercício:
 * o ano vem do sufixo de `numeroEmpenho`.
 */
export function exerciciosDosVinculos(
  fases: { numeroEmpenho?: string | null }[]
): string[] {
  return [
    ...new Set(fases.map((f) => exercicioDe(f.numeroEmpenho ?? "")).filter(Boolean)),
  ];
}

/** Exercício mais recente, usado como seleção padrão do dashboard. */
export function exercicioMaisRecente(empenhos: Empenho[]): string | null {
  return exerciciosDe(empenhos)[0] ?? null;
}
