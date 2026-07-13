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
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
