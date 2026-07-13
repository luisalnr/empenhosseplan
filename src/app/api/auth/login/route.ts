import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/lib/db/neon";
import { usuarios, loginAuditoria } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { newId } from "@/lib/auth/id";
import {
  SESSION_COOKIE,
  signSession,
  sessionCookieOptions,
  MAX_AGE_SEC,
  MAX_AGE_REMEMBER_SEC,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function issueSession(
  user: { id: string; email: string; name: string; papel: string },
  remember: boolean
) {
  const maxAge = remember ? MAX_AGE_REMEMBER_SEC : MAX_AGE_SEC;
  const token = signSession(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      papel: user.papel,
    },
    maxAge
  );
  const res = NextResponse.json({
    ok: true,
    id: user.id,
    email: user.email,
    name: user.name,
    papel: user.papel,
    remember,
    expiresInDays: remember ? 7 : null,
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      remember?: boolean;
    };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const remember = Boolean(body.remember);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    const userAgent = req.headers.get("user-agent") || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    if (hasDatabaseUrl()) {
      try {
        const db = getDb();
        const rows = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, email))
          .limit(1);
        const user = rows[0];

        if (user) {
          const ok = user.ativo && verifyPassword(password, user.senhaHash);
          await db.insert(loginAuditoria).values({
            id: newId(),
            usuarioId: user.id,
            email,
            sucesso: ok,
            ip,
            userAgent,
            detalhe: ok
              ? remember
                ? "login_ok_remember_7d"
                : "login_ok"
              : user.ativo
                ? "senha_invalida"
                : "usuario_inativo",
          });

          if (!ok) {
            return NextResponse.json(
              { error: "E-mail ou senha incorretos." },
              { status: 401 }
            );
          }

          return issueSession(
            {
              id: user.id,
              email: user.email,
              name: user.nome || "Usuário",
              papel: user.papel || "operador",
            },
            remember
          );
        }

        await db.insert(loginAuditoria).values({
          id: newId(),
          usuarioId: null,
          email,
          sucesso: false,
          ip,
          userAgent,
          detalhe: "usuario_nao_encontrado",
        });
      } catch (dbErr) {
        console.error("auth/login db error:", dbErr);
      }
    }

    // Fallback AUTH_*
    const expectedEmail = (process.env.AUTH_EMAIL || "").trim().toLowerCase();
    const expectedPassword = process.env.AUTH_PASSWORD || "";
    const name = process.env.AUTH_NAME || "SEPLAN/AC";

    if (
      expectedEmail &&
      expectedPassword &&
      email === expectedEmail &&
      password === expectedPassword
    ) {
      return issueSession(
        {
          id: "env-admin",
          email: expectedEmail,
          name,
          papel: "admin",
        },
        remember
      );
    }

    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}
