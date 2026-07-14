/**
 * Migração pontual: coluna `exercicio` em `empenhos` (+ índice) e backfill a
 * partir do sufixo do número do empenho ("7130010001/2026" → "2026").
 *
 * Idempotente — pode rodar mais de uma vez sem efeito colateral.
 * Uso: npx tsx --env-file=.env.local scripts/migrate-exercicio.ts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente (use --env-file=.env.local)");

const sql = neon(url);

async function main() {
  const antes = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'empenhos' AND column_name = 'exercicio'
  `;
  console.log(antes.length ? "coluna exercicio: já existe" : "coluna exercicio: será criada");

  await sql`ALTER TABLE empenhos ADD COLUMN IF NOT EXISTS exercicio text NOT NULL DEFAULT ''`;
  await sql`CREATE INDEX IF NOT EXISTS idx_empenhos_exercicio ON empenhos (exercicio)`;

  const r = await sql`
    UPDATE empenhos
       SET exercicio = split_part(numero, '/', 2)
     WHERE exercicio = '' AND numero LIKE '%/%'
  `;
  console.log("backfill: linhas atualizadas =", (r as unknown as { length: number }).length ?? 0);

  const dist = await sql`
    SELECT exercicio, count(*)::int AS n FROM empenhos GROUP BY exercicio ORDER BY exercicio DESC
  `;
  console.log("distribuição por exercício:", dist);

  const semExercicio = await sql`SELECT count(*)::int AS n FROM empenhos WHERE exercicio = ''`;
  console.log("empenhos sem exercício:", semExercicio[0]?.n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
