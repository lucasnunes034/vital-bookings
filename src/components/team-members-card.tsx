import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
  full_name: z.string().trim().max(120).optional(),
});

/** Membros da equipe com acesso ao painel da mesma empresa (gerenciado pelo dono). */
export function TeamMembersCard({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const q = useQuery({
    queryKey: ["team-members", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, email, full_name, user_id, created_at")
        .eq("company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ email, full_name: name || undefined });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.from("company_members").insert({
        company_id: companyId,
        email: parsed.data.email,
        full_name: parsed.data.full_name ?? null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Este e-mail já faz parte da equipe.");
        if (error.code === "42501") throw new Error("Apenas o dono da empresa pode adicionar membros.");
        throw error;
      }
    },
    onSuccess: () => {
      setEmail(""); setName("");
      qc.invalidateQueries({ queryKey: ["team-members", companyId] });
      toast.success("Membro adicionado", { description: "Ele terá acesso ao entrar com este e-mail." });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível adicionar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", companyId] });
      toast.success("Acesso removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover."),
  });

  return (
    <section className="surface-card p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold">Membros da equipe (acesso ao painel)</h2>
          <p className="text-sm text-muted-foreground">
            Quem você adicionar aqui entra com o próprio e-mail e vê os dados desta empresa. A assinatura é a da empresa.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:gap-3"
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="tm-email">E-mail</Label>
          <Input id="tm-email" type="email" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tecnico@email.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tm-name">Nome (opcional)</Label>
          <Input id="tm-name" className="h-12" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do membro" />
        </div>
        <button type="submit" disabled={add.isPending} className="btn-primary h-12 justify-center">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Adicionar
        </button>
      </form>

      {q.isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum membro adicionado ainda.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {q.data!.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.full_name || m.email}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.email} · {m.user_id ? "Ativo" : "Aguardando primeiro acesso"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Remover membro"
                onClick={() => remove.mutate(m.id)}
                className="btn-ghost h-10 !px-3 text-destructive shrink-0"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
