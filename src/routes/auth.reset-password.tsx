import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha · Slotly" },
      { name: "description", content: "Defina uma nova senha para sua conta Slotly." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(6, "Mínimo de 6 caracteres").max(72);

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passR = passwordSchema.safeParse(password);
    if (!passR.success) return toast.error(passR.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passR.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="container-page flex h-16 items-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative size-7 rounded-lg overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="size-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-display text-lg font-semibold">Slotly</span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <form onSubmit={onSubmit} className="surface-card w-full max-w-md p-8 space-y-5">
          <div>
            <h1 className="font-display text-2xl font-semibold">Defina uma nova senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escolha uma senha de pelo menos 6 caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
