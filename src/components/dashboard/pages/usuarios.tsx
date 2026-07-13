"use client";

import * as React from "react";
import {
  Loader2,
  UserPlus,
  Trash2,
  Shield,
  User,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface UsuarioRow {
  id: string;
  email: string;
  nome: string;
  papel: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

export function UsuariosPage() {
  const { user, isAdmin } = useAuth();
  const [lista, setLista] = React.useState<UsuarioRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  // formulário novo usuário
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [papel, setPapel] = React.useState<"admin" | "operador">("operador");
  const [showPass, setShowPass] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const carregar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/usuarios", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao carregar usuários");
      setLista(data.usuarios || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAdmin) void carregar();
  }, [isAdmin, carregar]);

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <Shield className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem gerenciar logins.
        </p>
      </div>
    );
  }

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, password, papel, ativo: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao criar usuário");
      setMsg(`Usuário ${data.usuario?.email || email} criado.`);
      setNome("");
      setEmail("");
      setPassword("");
      setPapel("operador");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (u: UsuarioRow) => {
    setBusyId(u.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/auth/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar");
      setMsg(`Usuário ${u.email} ${!u.ativo ? "ativado" : "desativado"}.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  };

  const alterarPapel = async (u: UsuarioRow, novo: "admin" | "operador") => {
    setBusyId(u.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/auth/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel: novo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar papel");
      setMsg(`Papel de ${u.email} alterado para ${novo}.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  };

  const redefinirSenha = async (u: UsuarioRow) => {
    const nova = window.prompt(`Nova senha para ${u.email} (mín. 6 caracteres):`);
    if (!nova) return;
    setBusyId(u.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/auth/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nova }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao redefinir senha");
      setMsg(`Senha de ${u.email} atualizada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  };

  const remover = async (u: UsuarioRow) => {
    if (!window.confirm(`Excluir o usuário ${u.email}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setBusyId(u.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/auth/usuarios/${u.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao excluir");
      setMsg(`Usuário ${u.email} excluído.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Gestão de logins</h2>
          <p className="text-sm text-muted-foreground">
            Crie, ative/desative e remova usuários. Somente administradores.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          {msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Formulário de criação */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <UserPlus className="h-4 w-4 text-primary" />
              Novo usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={criar} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="u-nome">Nome</Label>
                <Input
                  id="u-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-email">E-mail</Label>
                <Input
                  id="u-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@seplan.ac.gov.br"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-pass">Senha</Label>
                <div className="relative">
                  <Input
                    id="u-pass"
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Papel</Label>
                <div className="flex rounded-md border border-border p-0.5">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      papel === "operador"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setPapel("operador")}
                  >
                    Operador
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      papel === "admin"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setPapel("admin")}
                  >
                    Administrador
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full gap-1.5" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Criar login
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">
              Usuários cadastrados ({lista.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : lista.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            ) : (
              <div className="max-h-[28rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.map((u) => {
                      const isSelf = u.id === user?.id || u.email === user?.email;
                      const busy = busyId === u.id;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{u.nome || "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={u.papel === "admin" ? "default" : "secondary"}
                              className="gap-1 text-[10px]"
                            >
                              {u.papel === "admin" ? (
                                <Shield className="h-3 w-3" />
                              ) : (
                                <User className="h-3 w-3" />
                              )}
                              {u.papel === "admin" ? "Admin" : "Operador"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.ativo ? (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <XCircle className="h-3.5 w-3.5" /> Inativo
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={busy || isSelf}
                                onClick={() =>
                                  void alterarPapel(
                                    u,
                                    u.papel === "admin" ? "operador" : "admin"
                                  )
                                }
                              >
                                {u.papel === "admin" ? "Tornar op." : "Tornar admin"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={busy || isSelf}
                                onClick={() => void toggleAtivo(u)}
                              >
                                {u.ativo ? "Desativar" : "Ativar"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={busy}
                                onClick={() => void redefinirSenha(u)}
                              >
                                Senha
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={busy || isSelf}
                                onClick={() => void remover(u)}
                                aria-label="Excluir"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
