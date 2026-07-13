import { NextResponse } from "next/server";
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
      // Substitui tudo: delete + insert em batches
      await db.delete(empenhos);
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
      .onConflictDoUpdate({
        target: empenhos.numero,
        set: {
          dataEmissao: empenhos.dataEmissao,
          motivo: empenhos.motivo,
          tipo: empenhos.tipo,
          descricao: empenhos.descricao,
          reduzido: empenhos.reduzido,
          despesa: empenhos.despesa,
          credor: empenhos.credor,
          categoriaCodigo: empenhos.categoriaCodigo,
          categoriaDescricao: empenhos.categoriaDescricao,
          gndCodigo: empenhos.gndCodigo,
          gndDescricao: empenhos.gndDescricao,
          modalidadeCodigo: empenhos.modalidadeCodigo,
          modalidadeDescricao: empenhos.modalidadeDescricao,
          elementoCodigo: empenhos.elementoCodigo,
          elementoDescricao: empenhos.elementoDescricao,
          fonteCodigo: empenhos.fonteCodigo,
          fonteDescricao: empenhos.fonteDescricao,
          classeCodigo: empenhos.classeCodigo,
          classeDescricao: empenhos.classeDescricao,
          valor: empenhos.valor,
          anulado: empenhos.anulado,
          complemento: empenhos.complemento,
          liquidado: empenhos.liquidado,
          pago: empenhos.pago,
          aLiquidar: empenhos.aLiquidar,
        },
      });
  }
}
