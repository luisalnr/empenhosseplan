import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/neon";
import { pagamentos } from "@/lib/db/schema";
import { rowToFase, fasesToInserts } from "@/lib/db/mappers";
import { exerciciosDosVinculos } from "@/lib/exercicio";
import type { FaseDespesa } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(pagamentos);
    return NextResponse.json(rows.map(rowToFase));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar pagamentos" },
      { status: 500 }
    );
  }
}

interface PostBody {
  mode?: "merge" | "replace";
  records: FaseDespesa[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    if (!body || !Array.isArray(body.records)) {
      return NextResponse.json({ error: "Body inválido: { mode, records }" }, { status: 400 });
    }
    const mode = body.mode ?? "replace";
    const records = body.records;
    const db = getDb();
    const inserts = fasesToInserts(records);

    if (mode === "replace") {
      // Escopado ao exercício do empenho vinculado (sufixo de numero_empenho),
      // para que reimportar um ano não apague as fases dos demais.
      const exercicios = exerciciosDosVinculos(inserts);
      if (exercicios.length) {
        await db
          .delete(pagamentos)
          .where(inArray(sql`split_part(${pagamentos.numeroEmpenho}, '/', 2)`, exercicios));
      }
      await batchInsert(db, inserts);
    } else if (inserts.length) {
      await batchUpsert(db, inserts);
    }

    return NextResponse.json({ inserted: records.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar pagamentos" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const db = getDb();
    await db.delete(pagamentos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao limpar pagamentos" },
      { status: 500 }
    );
  }
}

async function batchInsert(
  db: ReturnType<typeof getDb>,
  inserts: ReturnType<typeof fasesToInserts>
) {
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    await db.insert(pagamentos).values(inserts.slice(i, i + CHUNK));
  }
}

async function batchUpsert(
  db: ReturnType<typeof getDb>,
  inserts: ReturnType<typeof fasesToInserts>
) {
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    await db
      .insert(pagamentos)
      .values(chunk)
      .onConflictDoUpdate({
        target: pagamentos.numero,
        set: {
          data: sql`excluded.data`,
          numeroEmpenho: sql`excluded.numero_empenho`,
          status: sql`excluded.status`,
          valor: sql`excluded.valor`,
        },
      });
  }
}
