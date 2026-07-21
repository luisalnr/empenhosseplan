import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/lib/db/neon";
import { periodosAnalise } from "@/lib/db/schema";
import type { PeriodoAnalise } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/periodos — período declarado por exercício, no formato
 * { [exercicio]: { inicio, fim } }. Retorna {} se não houver banco ou se a
 * tabela ainda não existir (antes de `db:push`), para não quebrar o dashboard.
 */
export async function GET() {
  if (!hasDatabaseUrl()) return NextResponse.json({});
  try {
    const db = getDb();
    const rows = await db
      .select({
        exercicio: periodosAnalise.exercicio,
        inicio: periodosAnalise.inicio,
        fim: periodosAnalise.fim,
      })
      .from(periodosAnalise);

    const mapa: Record<string, PeriodoAnalise> = {};
    for (const r of rows) {
      if (r.exercicio && r.inicio && r.fim) {
        mapa[r.exercicio] = { inicio: r.inicio, fim: r.fim };
      }
    }
    return NextResponse.json(mapa);
  } catch (e) {
    // Tabela ainda não migrada ou indisponível: cai no seed/emissão no cliente.
    console.error("GET /api/periodos", e);
    return NextResponse.json({});
  }
}

interface PostBody {
  periodos?: { exercicio: string; inicio: string; fim: string }[];
}

/**
 * POST /api/periodos — upsert do período declarado de um ou mais exercícios.
 * Chamado no import; o último relatório de um exercício define seu período.
 */
export async function POST(req: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }
  try {
    const body = (await req.json()) as PostBody;
    const entradas = (body.periodos || []).filter(
      (p) => p && p.exercicio && p.inicio && p.fim
    );
    if (!entradas.length) return NextResponse.json({ ok: true, gravados: 0 });

    const db = getDb();
    for (const p of entradas) {
      await db
        .insert(periodosAnalise)
        .values({ exercicio: p.exercicio, inicio: p.inicio, fim: p.fim })
        .onConflictDoUpdate({
          target: periodosAnalise.exercicio,
          set: {
            inicio: sql`excluded.inicio`,
            fim: sql`excluded.fim`,
            atualizadoEm: sql`now()`,
          },
        });
    }
    return NextResponse.json({ ok: true, gravados: entradas.length });
  } catch (e) {
    console.error("POST /api/periodos", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar período" },
      { status: 500 }
    );
  }
}
