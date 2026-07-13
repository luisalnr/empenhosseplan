/**
 * Cria/atualiza o usuário administrador na tabela `usuarios` (Neon).
 *
 * Uso:
 *   npx tsx scripts/seed-admin.ts
 *
 * Credenciais padrão (sobrescreva com env):
 *   ADMIN_EMAIL=admin@seplan.ac.gov.br
 *   ADMIN_PASSWORD=Admin@SEPLAN2026
 *   ADMIN_NAME=Administrador SEPLAN
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { usuarios } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { newId } from "../src/lib/auth/id";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eqIdx = t.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = t.slice(0, eqIdx).trim();
    let val = t.slice(eqIdx + 1).trim();
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

async function main() {
  loadEnvLocal();
  const connectionString = resolveUrl();
  if (!connectionString) {
    console.error("❌ DATABASE_URL não definida.");
    process.exit(1);
  }

  const email = (
    process.env.ADMIN_EMAIL ||
    process.env.AUTH_EMAIL ||
    "admin@seplan.ac.gov.br"
  )
    .trim()
    .toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD || "Admin@SEPLAN2026";
  const nome =
    process.env.ADMIN_NAME || process.env.AUTH_NAME || "Administrador SEPLAN";

  const sql = neon(connectionString);
  const db = drizzle(sql, { schema });

  const senhaHash = hashPassword(password);
  const existentes = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  if (existentes[0]) {
    await db
      .update(usuarios)
      .set({
        nome,
        senhaHash,
        papel: "admin",
        ativo: true,
        atualizadoEm: new Date(),
      })
      .where(eq(usuarios.email, email));
    console.log(`✅ Administrador atualizado: ${email}`);
  } else {
    await db.insert(usuarios).values({
      id: newId(),
      email,
      nome,
      senhaHash,
      papel: "admin",
      ativo: true,
    });
    console.log(`✅ Administrador criado: ${email}`);
  }

  console.log("");
  console.log("── Credenciais de acesso ──");
  console.log(`   E-mail : ${email}`);
  console.log(`   Senha  : ${password}`);
  console.log(`   Nome   : ${nome}`);
  console.log(`   Papel  : admin`);
  console.log("───────────────────────────");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Erro no seed de admin:", e);
  process.exit(1);
});
