import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Singleton do cliente Drizzle + Neon (server-only).
 * Driver HTTP serverless — ideal para Vercel.
 *
 * Ordem de resolução da connection string:
 *   1. DATABASE_URL
 *   2. POSTGRES_URL / POSTGRES_PRISMA_URL (templates Vercel)
 *
 * Em Vercel, defina também NEXT_PUBLIC_USE_NEON=true no projeto.
 */
let dbInstance: ReturnType<typeof drizzle> | null = null;

/** Normaliza URL (remove channel_binding se presente — incompatível com alguns drivers HTTP). */
function normalizeConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function resolveDatabaseUrl(): string | undefined {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED;
  return raw ? normalizeConnectionString(raw) : undefined;
}

export function getDb() {
  if (dbInstance) return dbInstance;
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (ou POSTGRES_URL) não definida. Configure no Vercel ou em .env.local"
    );
  }
  const sql = neon(connectionString);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

/** Flag: há URL de banco disponível no ambiente server-side? */
export const hasDatabaseUrl = (): boolean => Boolean(resolveDatabaseUrl());
