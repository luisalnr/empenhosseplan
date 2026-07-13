import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Login simples para o painel SEPLAN.
 * Credenciais via env (Vercel / .env.local):
 *   AUTH_EMAIL (default: seplan@acre.gov.br)
 *   AUTH_PASSWORD (default: seplan2026)
 *   AUTH_NAME (default: SEPLAN/AC)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Informe e-mail e senha." },
        { status: 400 }
      );
    }

    const expectedEmail = (
      process.env.AUTH_EMAIL || "seplan@acre.gov.br"
    )
      .trim()
      .toLowerCase();
    const expectedPassword = process.env.AUTH_PASSWORD || "seplan2026";
    const name = process.env.AUTH_NAME || "SEPLAN/AC";

    if (email !== expectedEmail || password !== expectedPassword) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: expectedEmail,
      name,
    });
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}
