import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/lib/db/neon";
import { usuarios } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/auth/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — lista usuários (somente admin). */
export async function GET() {
  const admin = requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: usuarios.id,
        email: usuarios.email,
        nome: usuarios.nome,
        papel: usuarios.papel,
        ativo: usuarios.ativo,
        criadoEm: usuarios.criadoEm,
        atualizadoEm: usuarios.atualizadoEm,
      })
      .from(usuarios)
      .orderBy(asc(usuarios.email));

    return NextResponse.json({
      usuarios: rows.map((r) => ({
        ...r,
        criadoEm: r.criadoEm?.toISOString?.() ?? r.criadoEm,
        atualizadoEm: r.atualizadoEm?.toISOString?.() ?? r.atualizadoEm,
      })),
    });
  } catch (e) {
    console.error("GET /api/auth/usuarios", e);
    return NextResponse.json({ error: "Erro ao listar usuários." }, { status: 500 });
  }
}

/** POST — cria usuário (somente admin). */
export async function POST(req: Request) {
  const admin = requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      nome?: string;
      password?: string;
      papel?: string;
      ativo?: boolean;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const nome = String(body.nome || "").trim();
    const password = String(body.password || "");
    const papel = body.papel === "admin" ? "admin" : "operador";
    const ativo = body.ativo !== false;

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);
    if (existing[0]) {
      return NextResponse.json(
        { error: "Já existe um usuário com este e-mail." },
        { status: 409 }
      );
    }

    const id = newId();
    await db.insert(usuarios).values({
      id,
      email,
      nome: nome || email.split("@")[0],
      senhaHash: hashPassword(password),
      papel,
      ativo,
    });

    return NextResponse.json({
      ok: true,
      usuario: { id, email, nome: nome || email.split("@")[0], papel, ativo },
    });
  } catch (e) {
    console.error("POST /api/auth/usuarios", e);
    return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }
}
