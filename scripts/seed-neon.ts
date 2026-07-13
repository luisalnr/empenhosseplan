/**
 * Seed inicial para Neon Postgres.
 * Lê public/data/seed-empenhos.json e insere (upsert) no banco.
 *
 * Uso:
 *   npx tsx scripts/seed-neon.ts
 *
 * Requer DATABASE_URL no .env.local ou ambiente.
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { count } from "drizzle-orm";
import { empenhos } from "../src/lib/db/schema";
import { empenhosToInserts } from "../src/lib/db/mappers";
import type { Empenho } from "../src/lib/types";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL não definida. Configure no .env.local ou ambiente.");
    process.exit(1);
  }

  const seedPath = path.resolve(process.cwd(), "public/data/seed-empenhos.json");
  if (!fs.existsSync(seedPath)) {
    console.error("❌ seed-empenhos.json não encontrado em public/data/");
    process.exit(1);
  }

  console.log("📖 Lendo seed-empenhos.json…");
  const records: Empenho[] = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  console.log(`   ${records.length} empenhos carregados.`);

  const sql = neon(connectionString);
  const db = drizzle(sql, { schema });
  const inserts = empenhosToInserts(records);

  console.log("🗑️  Limpando tabela empenhos…");
  await db.delete(empenhos);

  console.log("💾 Inserindo registros (chunks de 50)…");
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    await db.insert(empenhos).values(inserts.slice(i, i + CHUNK));
    process.stdout.write(`   ${Math.min(i + CHUNK, inserts.length)}/${inserts.length}\r`);
  }
  console.log("");

  const [c] = await db.select({ value: count() }).from(empenhos);
  console.log(`✅ Seed concluído. Total no banco: ${c?.value ?? "?"}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Erro no seed:", e);
  process.exit(1);
});
