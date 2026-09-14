import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, ArrowLeft, Loader2, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta grátis · Slotly" },
      {
        name: "description",
        content:
          "Cadastre sua empresa no Slotly e teste grátis por 7 dias: agenda online, clientes, orçamentos e financeiro.",
      },
      { property: "og:title", content: "Criar conta grátis · Slotly" },
      {
        property: "og:description",
        content: "Cadastro em 1 minuto e 7 dias grátis para testar o Slotly na sua empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

const schema = z.object({
  companyName: z.string().trim().min(2, "Informe o nome da empresa").max(80),
  ownerName: z.string().trim().min(2, "Informe o nome do responsável").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres").max(72),
  cpf: z.string().refine((v) => onlyDigits(v).length === 11, "CPF deve conter 11 dígitos"),
});

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 36);
}

const BENEFITS = [
  "7 dias grátis, sem cartão de crédito",
  "Agenda online com link público da sua empresa",
  "Clientes, orçamentos e relatórios em um só lugar",
];

function SignupPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ companyName, ownerName, email, password, cpf });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const cpfDigits = onlyDigits(parsed.data.cpf);

    setLoading(true);
    try {
      // 1. CPF não pode ser duplicado
      const { data: existing, error: cpfError } = await supabase
        .from("companies")
        .select("id")
        .eq("cpf", cpfDigits)
        .limit(1);
      if (cpfError) throw cpfError;
      if (existing && existing.length > 0) {
        toast.error("Este CPF já está cadastrado em outra empresa.");
        return;
      }

      // 2. Cria o usuário
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: parsed.data.ownerName },
        },
      });
      if (signUpError) {
        toast.error(
          signUpError.message.toLowerCase().includes("already registered")
            ? "Este email já está cadastrado. Faça login para continuar."
            : signUpError.message,
        );
        return;
      }

      let userId = signUpData.user?.id ?? null;
      if (!signUpData.session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        userId = signInData.user?.id ?? userId;
        if (!signInData.session) {
          setPendingEmail(true);
          return;
        }
      }
      if (!userId) {
        toast.error("Não conseguimos concluir o cadastro. Tente novamente.");
        return;
      }

      // 3. Cria a empresa com trial de 7 dias
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 7);

      const base = slugify(parsed.data.companyName) || "empresa";
      let slug = base;
      let attempt = 0;
      let companyError: { message: string; code?: string } | null = null;

      while (attempt < 5) {
        const { error } = await supabase.from("companies").insert({
          owner_id: userId,
          name: parsed.data.companyName,
          slug,
          segment: "Outro",
          cpf: cpfDigits,
          subscription_status: "trial",
          subscription_ends_at: endsAt.toISOString(),
        });
        if (!error) {
          companyError = null;
          break;
        }
        companyError = error;
        if (error.code === "23505" && error.message.includes("slug")) {
          attempt += 1;
          slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
          continue;
        }
        break;
      }

      if (companyError) {
        if (companyError.code === "23505" && companyError.message.includes("cpf")) {
          toast.error("Este CPF já está cadastrado em outra empresa.");
        } else {
          toast.error("Não conseguimos criar sua empresa. Tente novamente.");
        }
        return;
      }

      toast.success("Bem-vindo ao Slotly! Seus 7 dias grátis começaram agora.", {
        description: "Aproveite todos os recursos sem compromisso.",
        duration: 6000,
      });
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Algo deu errado no cadastro. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="container-page flex h-16 items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span className="text-sm">Voltar</span>
        </Link>
        <Link to="/" className="flex items-center gap-2">
          <div
            className="relative size-7 rounded-lg overflow-hidden"
            style={{ background: "var(--gradient-brand)" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="size-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-display text-lg font-semibold">Slotly</span>
        </Link>
      </header>

      <main className="relative flex-1 px-4 pb-16">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="relative mx-auto grid w-full max-w-4xl items-center gap-8 py-8 md:grid-cols-2">
          <div className="hidden md:block">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Comece grátis por 7 dias
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Crie a conta da sua empresa em menos de um minuto e comece a receber agendamentos hoje.
            </p>
            <ul className="mt-6 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card p-6 sm:p-8">
            {pendingEmail ? (
              <div className="text-center">
                <h2 className="font-display text-xl font-semibold">Confirme seu email</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar,
                  entre para ativar seus 7 dias grátis.
                </p>
                <Link to="/auth" className="btn-primary mt-6 w-full">
                  Ir para o login
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center md:text-left">
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    Criar conta grátis
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    7 dias de teste, sem cartão de crédito.
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <Field label="Nome da empresa" htmlFor="companyName">
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Clima Perfeito Serviços"
                      required
                    />
                  </Field>
                  <Field label="Nome do responsável" htmlFor="ownerName">
                    <Input
                      id="ownerName"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Ana Ribeiro"
                      autoComplete="name"
                      required
                    />
                  </Field>
                  <Field label="E-mail" htmlFor="email">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      required
                    />
                  </Field>
                  <Field label="Senha" htmlFor="password">
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </Field>
                  <Field label="CPF" htmlFor="cpf">
                    <Input
                      id="cpf"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(maskCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      required
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Criar conta e liberar 7 dias grátis"
                    )}
                  </button>
                </form>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Já tem conta?{" "}
                  <Link to="/auth" className="text-foreground underline underline-offset-4">
                    Entrar
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
