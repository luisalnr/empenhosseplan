import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/neon";
import { empenhos } from "@/lib/db/schema";
import { rowToEmpenho, empenhosToInserts } from "@/lib/db/mappers";
import type { Empenho } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/empenhos — lista todos os empenhos. */
export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(empenhos);
    const list: Empenho[] = rows.map(rowToEmpenho);
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar empenhos" },
      { status: 500 }
    );
  }
}

interface PostBody {
  mode: "merge" | "replace";
  records: Empenho[];
}

/** POST /api/empenhos — upsert (merge) ou replace all. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    if (!body || !Array.isArray(body.records)) {
      return NextResponse.json({ error: "Body inválido: { mode, records }" }, { status: 400 });
    }
    const { mode, records } = body;
    if (records.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    const db = getDb();
    const inserts = empenhosToInserts(records);

    if (mode === "replace") {
      // Replace é escopado aos exercícios presentes no arquivo: reimportar 2026
      // não pode apagar 2025. Sem escopo, a base inteira seria perdida.
      const exercicios = [...new Set(inserts.map((i) => i.exercicio).filter(Boolean))] as string[];
      if (exercicios.length) {
        await db.delete(empenhos).where(inArray(empenhos.exercicio, exercicios));
      }
      await batchInsert(db, inserts);
    } else {
      // Merge: upsert (on conflict do update)
      await batchUpsert(db, inserts);
    }

    return NextResponse.json({ inserted: records.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar empenhos" },
      { status: 500 }
    );
  }
}

/** DELETE /api/empenhos — limpa todos os empenhos. */
export async function DELETE() {
  try {
    const db = getDb();
    await db.delete(empenhos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao limpar empenhos" },
      { status: 500 }
    );
  }
}

/** Insere em chunks de 50 para evitar payload grande por query. */
async function batchInsert(db: ReturnType<typeof getDb>, inserts: ReturnType<typeof empenhosToInserts>) {
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    await db.insert(empenhos).values(inserts.slice(i, i + CHUNK));
  }
}

/** Upsert (INSERT ... ON CONFLICT DO UPDATE) em chunks de 50. */
async function batchUpsert(db: ReturnType<typeof getDb>, inserts: ReturnType<typeof empenhosToInserts>) {
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    await db
      .insert(empenhos)
      .values(chunk)
      // `excluded.*` = a linha que estava sendo inserida. Referenciar a coluna
      // (empenhos.x) reescreveria o valor antigo sobre ele mesmo — o merge viraria no-op.
      .onConflictDoUpdate({
        target: empenhos.numero,
        set: {
          exercicio: sql`excluded.exercicio`,
          dataEmissao: sql`excluded.data_emissao`,
          motivo: sql`excluded.motivo`,
          tipo: sql`excluded.tipo`,
          descricao: sql`excluded.descricao`,
          reduzido: sql`excluded.reduzido`,
          despesa: sql`excluded.despesa`,
          credor: sql`excluded.credor`,
          categoriaCodigo: sql`excluded.categoria_codigo`,
          categoriaDescricao: sql`excluded.categoria_descricao`,
          gndCodigo: sql`excluded.gnd_codigo`,
          gndDescricao: sql`excluded.gnd_descricao`,
          modalidadeCodigo: sql`excluded.modalidade_codigo`,
          modalidadeDescricao: sql`excluded.modalidade_descricao`,
          elementoCodigo: sql`excluded.elemento_codigo`,
          elementoDescricao: sql`excluded.elemento_descricao`,
          fonteCodigo: sql`excluded.fonte_codigo`,
          fonteDescricao: sql`excluded.fonte_descricao`,
          classeCodigo: sql`excluded.classe_codigo`,
          classeDescricao: sql`excluded.classe_descricao`,
          valor: sql`excluded.valor`,
          anulado: sql`excluded.anulado`,
          complemento: sql`excluded.complemento`,
          liquidado: sql`excluded.liquidado`,
          pago: sql`excluded.pago`,
          aLiquidar: sql`excluded.a_liquidar`,
        },
      });
  }
}
