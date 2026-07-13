import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Singleton do cliente Drizzle + Neon (server-only).
 * Usa o driver HTTP serverless do Neon, ideal para Vercel Edge/Serverless.
 *
 * Requer DATABASE_URL nas variáveis de ambiente (Vercel ou .env.local).
 */
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Configure a variável de ambiente no Vercel ou .env.local"
    );
  }
  const sql = neon(connectionString);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

/** Flag: DATABASE_URL está disponível no ambiente server-side? */
export const hasDatabaseUrl = (): boolean => Boolean(process.env.DATABASE_URL);
