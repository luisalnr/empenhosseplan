import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/lib/db/neon";
import { usuarios } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** PATCH — atualiza usuário (somente admin). */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      nome?: string;
      papel?: string;
      ativo?: boolean;
      password?: string;
    };

    const db = getDb();
    const rows = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Impede o admin de remover o próprio papel admin ou se desativar
    if (admin.id === id) {
      if (body.papel && body.papel !== "admin") {
        return NextResponse.json(
          { error: "Você não pode remover o próprio perfil de administrador." },
          { status: 400 }
        );
      }
      if (body.ativo === false) {
        return NextResponse.json(
          { error: "Você não pode desativar a própria conta." },
          { status: 400 }
        );
      }
    }

    const patch: Partial<typeof usuarios.$inferInsert> = {
      atualizadoEm: new Date(),
    };
    if (typeof body.nome === "string") patch.nome = body.nome.trim();
    if (body.papel === "admin" || body.papel === "operador") patch.papel = body.papel;
    if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: "A senha deve ter pelo menos 6 caracteres." },
          { status: 400 }
        );
      }
      patch.senhaHash = hashPassword(body.password);
    }

    await db.update(usuarios).set(patch).where(eq(usuarios.id, id));

    const updated = (
      await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1)
    )[0];

    return NextResponse.json({
      ok: true,
      usuario: {
        id: updated.id,
        email: updated.email,
        nome: updated.nome,
        papel: updated.papel,
        ativo: updated.ativo,
      },
    });
  } catch (e) {
    console.error("PATCH /api/auth/usuarios/[id]", e);
    return NextResponse.json({ error: "Erro ao atualizar usuário." }, { status: 500 });
  }
}

/** DELETE — remove usuário (somente admin; não pode excluir a si mesmo). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  if (admin.id === id) {
    return NextResponse.json(
      { error: "Você não pode excluir a própria conta." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const rows = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
    if (!rows[0]) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    await db.delete(usuarios).where(eq(usuarios.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/auth/usuarios/[id]", e);
    return NextResponse.json({ error: "Erro ao excluir usuário." }, { status: 500 });
  }
}
