import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — informa ao cliente se o servidor tem banco configurado.
 *
 * O cliente não pode confiar em NEXT_PUBLIC_USE_NEON: essa variável é resolvida no
 * build, então um deploy sem ela cai silenciosamente no IndexedDB e as importações
 * nunca chegam ao Postgres. Perguntar ao servidor em runtime elimina esse modo de
 * falha silencioso.
 */
export async function GET() {
  return NextResponse.json({ neon: Boolean(process.env.DATABASE_URL) });
}
