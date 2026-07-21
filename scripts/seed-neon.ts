/**
 * Seed inicial para Neon Postgres.
 * Lê JSONs em public/data e faz upsert nas tabelas empenhos / liquidacoes / pagamentos.
 *
 * Uso (com .env.local na raiz):
 *   npx tsx scripts/seed-neon.ts
 *
 * Ou:
 *   npm run db:seed
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { count } from "drizzle-orm";
import { empenhos, liquidacoes, pagamentos, periodosAnalise } from "../src/lib/db/schema";
import * as schema from "../src/lib/db/schema";
import { empenhosToInserts, fasesToInserts } from "../src/lib/db/mappers";
import type { Empenho, FaseDespesa, PeriodoAnalise } from "../src/lib/types";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function resolveUrl(): string | undefined {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw;
  }
}

async function batchInsert<T extends Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insertFn: (chunk: T[]) => Promise<any>,
  rows: T[],
  label: string
) {
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insertFn(rows.slice(i, i + CHUNK));
    process.stdout.write(`   ${label}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}\r`);
  }
  if (rows.length) console.log("");
}

async function main() {
  loadEnvLocal();
  const connectionString = resolveUrl();
  if (!connectionString) {
    console.error("❌ DATABASE_URL não definida. Configure no .env.local ou ambiente.");
    process.exit(1);
  }

  const dataDir = path.resolve(process.cwd(), "public/data");
  const empPath = path.join(dataDir, "seed-empenhos.json");
  const liqPath = path.join(dataDir, "liquidacoes.json");
  const pagPath = path.join(dataDir, "pagamentos.json");

  if (!fs.existsSync(empPath)) {
    console.error("❌ seed-empenhos.json não encontrado em public/data/");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const db = drizzle(sql, { schema });

  // ── Empenhos ──
  const empRecords: Empenho[] = JSON.parse(fs.readFileSync(empPath, "utf-8"));
  console.log(`📖 Empenhos: ${empRecords.length}`);
  const empInserts = empenhosToInserts(empRecords);
  console.log("🗑️  Limpando empenhos…");
  await db.delete(empenhos);
  console.log("💾 Inserindo empenhos…");
  await batchInsert(
    (chunk) => db.insert(empenhos).values(chunk),
    empInserts,
    "empenhos"
  );

  // ── Liquidações ──
  if (fs.existsSync(liqPath)) {
    const liqRecords: FaseDespesa[] = JSON.parse(fs.readFileSync(liqPath, "utf-8"));
    console.log(`📖 Liquidações: ${liqRecords.length}`);
    const inserts = fasesToInserts(liqRecords);
    console.log("🗑️  Limpando liquidacoes…");
    await db.delete(liquidacoes);
    console.log("💾 Inserindo liquidacoes…");
    await batchInsert(
      (chunk) => db.insert(liquidacoes).values(chunk),
      inserts,
      "liquidacoes"
    );
  }

  // ── Pagamentos ──
  if (fs.existsSync(pagPath)) {
    const pagRecords: FaseDespesa[] = JSON.parse(fs.readFileSync(pagPath, "utf-8"));
    console.log(`📖 Pagamentos: ${pagRecords.length}`);
    const inserts = fasesToInserts(pagRecords);
    console.log("🗑️  Limpando pagamentos…");
    await db.delete(pagamentos);
    console.log("💾 Inserindo pagamentos…");
    await batchInsert(
      (chunk) => db.insert(pagamentos).values(chunk),
      inserts,
      "pagamentos"
    );
  }

  // ── Período declarado (cabeçalho do relatório) ──
  const perPath = path.join(dataDir, "seed-periodo.json");
  if (fs.existsSync(perPath)) {
    const periodo = JSON.parse(fs.readFileSync(perPath, "utf-8")) as PeriodoAnalise | null;
    if (periodo?.inicio && periodo?.fim) {
      const exercicio = periodo.inicio.slice(0, 4);
      console.log(`📖 Período ${exercicio}: ${periodo.inicio} a ${periodo.fim}`);
      await db
        .insert(periodosAnalise)
        .values({ exercicio, inicio: periodo.inicio, fim: periodo.fim })
        .onConflictDoUpdate({
          target: periodosAnalise.exercicio,
          set: { inicio: periodo.inicio, fim: periodo.fim },
        });
    }
  }

  const [ce] = await db.select({ value: count() }).from(empenhos);
  const [cl] = await db.select({ value: count() }).from(liquidacoes);
  const [cp] = await db.select({ value: count() }).from(pagamentos);
  console.log(
    `✅ Seed concluído. empenhos=${ce?.value ?? "?"} liquidacoes=${cl?.value ?? "?"} pagamentos=${cp?.value ?? "?"}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Erro no seed:", e);
  process.exit(1);
});
