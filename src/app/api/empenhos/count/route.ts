import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { getDb } from "@/lib/db/neon";
import { empenhos } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/empenhos/count — retorna { count }. */
export async function GET() {
  try {
    const db = getDb();
    const [r] = await db.select({ value: count() }).from(empenhos);
    return NextResponse.json({ count: Number(r?.value ?? 0) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao contar empenhos" },
      { status: 500 }
    );
  }
}
