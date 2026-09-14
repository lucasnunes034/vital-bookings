import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Slotly" },
      { name: "description", content: "Acesse sua conta Slotly ou crie uma grátis em segundos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo de 6 caracteres").max(72);
const nameSchema = z.string().trim().min(2, "Nome muito curto").max(100);

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
          <span className="text-sm">Voltar</span>
        </Link>
        <Link to="/" className="flex items-center gap-2">
          <div className="relative size-7 rounded-lg overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="size-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-display text-lg font-semibold">Slotly</span>
        </Link>
      </header>

      <div className="relative flex-1 flex items-center justify-center px-4 pb-16">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="relative w-full max-w-md">
          <div className="surface-card p-8">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight">Bem-vindo ao Slotly</h1>
              <p className="mt-1 text-sm text-muted-foreground">Entre ou crie sua conta grátis</p>
            </div>

            <GoogleButton />

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou com email
              <span className="h-px flex-1 bg-border" />
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap scrollbar-hide [&>*]:flex-1">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-5">
                <SignInForm />
              </TabsContent>
              <TabsContent value="signup" className="mt-5">
                <SignUpForm />
              </TabsContent>
            </Tabs>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ao continuar, você concorda com nossos termos e política de privacidade.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onClick = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não conseguimos entrar com Google. Tente novamente.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-ghost w-full disabled:opacity-60"
      type="button"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-8.6 0-.6-.1-1-.2-1.4H12z" />
        </svg>
      )}
      Continuar com Google
    </button>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailR = emailSchema.safeParse(email);
    const passR = passwordSchema.safeParse(password);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    if (!passR.success) return toast.error(passR.error.issues[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailR.data,
      password: passR.data,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message,
      );
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const onForgot = async () => {
    const emailR = emailSchema.safeParse(email);
    if (!emailR.success) {
      toast.error("Digite seu email primeiro");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(emailR.data, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para seu email.");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          required
        />
      </Field>
      <Field label="Senha">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </Field>
      <button type="button" onClick={onForgot} className="text-xs text-muted-foreground hover:text-foreground">
        Esqueci minha senha
      </button>
      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
      </button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameR = nameSchema.safeParse(fullName);
    const emailR = emailSchema.safeParse(email);
    const passR = passwordSchema.safeParse(password);
    if (!nameR.success) return toast.error(nameR.error.issues[0].message);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    if (!passR.success) return toast.error(passR.error.issues[0].message);

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: emailR.data,
      password: passR.data,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: nameR.data },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("already registered")
          ? "Este email já está cadastrado"
          : error.message,
      );
      return;
    }
    if (data.session) {
      toast.success("Conta criada! Bora configurar sua empresa.");
      navigate({ to: "/dashboard", replace: true });
    } else {
      toast.success("Conta criada! Confirme seu email para entrar.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Seu nome">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ana Ribeiro" required />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          required
        />
      </Field>
      <Field label="Senha">
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
        />
      </Field>
      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar conta grátis"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
