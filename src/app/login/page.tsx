"use client";

import * as React from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import {
  getRememberedEmail,
  getRememberedPassword,
  useAuth,
} from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { login, loading: authLoading, user, rememberPref } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Pré-preenche e-mail, senha e preferência de 7 dias (acesso rápido)
  React.useEffect(() => {
    if (authLoading) return;
    setRemember(rememberPref);
    const savedEmail = getRememberedEmail();
    const savedPass = getRememberedPassword();
    if (savedEmail) setEmail(savedEmail);
    if (savedPass) setPassword(savedPass);
  }, [authLoading, rememberPref]);

  // Evita flash do formulário enquanto redireciona usuário já autenticado
  if (authLoading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Painel institucional (esquerda) — inspira-se em orçamentostematicos */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-bar px-10 py-12 text-bar-foreground lg:flex">
        {/* decoração */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-secondary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10">
          <div className="relative h-14 w-[280px]">
            {/* SVG estático — logo branca horizontal do Governo do Acre */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-acre-branco.svg"
              alt="Governo do Estado do Acre"
              className="h-14 w-auto max-w-[280px] object-contain object-left"
            />
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Execução de
            <br />
            <span className="text-secondary">Empenhos</span>
          </h1>
          <p className="text-base leading-relaxed text-white/75">
            Acompanhe a execução dos empenhos dos contratos da Secretaria de
            Estado de Planejamento do Acre — empenhado, liquidado, pago e
            análise de restos a pagar, com importação dos relatórios SICAF.
          </p>
        </div>

        <div className="relative z-10 space-y-1 text-xs text-white/50">
          <p>Secretaria de Estado de Planejamento do Acre — SEPLAN</p>
          <p>Departamento de Estudos e Planejamento Orçamentário — DEPPO/SEPLAN</p>
          <p>
            Coordenador: Denyscley Bandeira · Equipe técnica: Ícaro Gundim,
            Luísa Ribeiro, Roseneide Sena e Vinícius Farias.
          </p>
          <p>© {new Date().getFullYear()} Governo do Estado do Acre · SEPLAN</p>
        </div>
      </aside>

      {/* Formulário (direita) — centralizado na coluna */}
      <main className="flex flex-col items-center justify-center bg-background px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          {/* Logo / topo do form */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-4 h-20 w-full sm:h-24">
              <Image
                src="/logo-governo-acre.png"
                alt="Governo do Estado do Acre"
                fill
                className="object-contain object-center"
                sizes="(max-width: 448px) 100vw, 448px"
                priority
              />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Execução de Empenhos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              SEPLAN — Secretaria de Estado de Planejamento
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">Entrar</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use suas credenciais institucionais para acessar o painel.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="seplan@acre.gov.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10 pr-10"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={submitting}
                />
                <span className="min-w-0 text-left">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Acesso rápido por 7 dias
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    Autorizo o armazenamento no cache deste navegador (e-mail,
                    senha e dados da sessão) por 7 dias para acesso rápido.
                    Desmarque se o dispositivo for compartilhado.
                  </span>
                </span>
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className={cn("h-11 w-full text-sm font-semibold")}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  "Acessar painel"
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Governo do Estado do Acre · Uso
            institucional
          </p>
        </div>
      </main>
    </div>
  );
}
