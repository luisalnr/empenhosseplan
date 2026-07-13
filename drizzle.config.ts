import { defineConfig } from "drizzle-kit";

/**
 * Configuração do Drizzle Kit.
 * - db:generate   → gera migrations SQL a partir do schema TS
 * - db:migrate    → aplica migrations no banco (usa DATABASE_URL_UNPOOLED)
 * - db:push       → sincroniza schema diretamente (dev/staging)
 * - db:studio     → abre Drizzle Studio (GUI do banco)
 *
 * Em produção use DATABASE_URL_UNPOOLED para migrations (sem pooler pgbouncer).
 * Em runtime (API routes) use DATABASE_URL (com pooler HTTP do Neon).
 */
function loadEnvLocal() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

function resolveMigrateUrl(): string {
  const raw =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw;
  }
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveMigrateUrl(),
  },
  verbose: true,
  strict: true,
});
