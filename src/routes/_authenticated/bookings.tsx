import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ArrowLeft, Check, X, Loader2, Clock, Phone, Mail, User, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatInTZ } from "@/lib/timezone";

type Status = "pending" | "confirmed" | "cancelled" | "completed";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Agendamentos · Slotly" },
      { name: "description", content: "Aprove, confirme e gerencie os agendamentos da sua empresa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingsPage,
});

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendentes",
  confirmed: "Confirmados",
  completed: "Concluídos",
  cancelled: "Cancelados",
};

function BookingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");

  const companyQ = useQuery({
    queryKey: ["my-company-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, slug, timezone").order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const bookingsQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["bookings", companyQ.data?.id, tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, service:services(name, duration_minutes, price_cents), professional:professionals(name)")
        .eq("company_id", companyQ.data!.id)
        .eq("status", tab)
        .order("start_at", { ascending: tab === "pending" || tab === "confirmed" });
      if (error) throw error;
      return data;
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: Status; reason?: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status, cancellation_reason: reason ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      const msg = v.status === "confirmed" ? "Agendamento confirmado" : v.status === "cancelled" ? "Agendamento recusado" : "Marcado como concluído";
      toast.success(msg);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  if (companyQ.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!companyQ.data) { navigate({ to: "/onboarding", replace: true }); return null; }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Painel
          </Link>
          <p className="text-sm text-muted-foreground">{companyQ.data.name}</p>
        </div>
      </header>

      <main className="container-page py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Agendamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprove ou recuse solicitações e acompanhe a agenda.
          </p>
        </div>

        <div className="flex gap-1 border-b border-border">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === s ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {bookingsQ.isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : bookingsQ.data?.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <Calendar className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nada por aqui ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookingsQ.data?.map((b: any) => (
              <div key={b.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground" />
                      <p className="font-medium">{formatDT(b.start_at, companyQ.data?.timezone)}</p>
                      <span className="text-xs text-muted-foreground">· {b.service?.duration_minutes} min</span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Serviço:</span> {b.service?.name} · <span className="text-muted-foreground">com</span> {b.professional?.name}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><User className="size-3" /> {b.customer_name}</span>
                      <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {b.customer_phone}</span>
                      {b.customer_email && <span className="inline-flex items-center gap-1"><Mail className="size-3" /> {b.customer_email}</span>}
                      {b.notes && <span className="inline-flex items-center gap-1"><StickyNote className="size-3" /> {b.notes}</span>}
                    </div>
                    {b.status === "cancelled" && b.cancellation_reason && (
                      <p className="text-xs text-muted-foreground">Motivo: {b.cancellation_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tab === "pending" && (
                      <>
                        <button
                          onClick={() => changeStatus.mutate({ id: b.id, status: "confirmed" })}
                          className="btn-primary h-9 !px-3 text-xs"
                          disabled={changeStatus.isPending}
                        >
                          <Check className="size-3.5" /> Confirmar
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt("Motivo da recusa (opcional):") ?? undefined;
                            changeStatus.mutate({ id: b.id, status: "cancelled", reason });
                          }}
                          className="btn-ghost h-9 !px-3 text-xs"
                          disabled={changeStatus.isPending}
                        >
                          <X className="size-3.5" /> Recusar
                        </button>
                      </>
                    )}
                    {tab === "confirmed" && (
                      <>
                        <button
                          onClick={() => changeStatus.mutate({ id: b.id, status: "completed" })}
                          className="btn-ghost h-9 !px-3 text-xs"
                          disabled={changeStatus.isPending}
                        >
                          <Check className="size-3.5" /> Concluir
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt("Motivo do cancelamento (opcional):") ?? undefined;
                            changeStatus.mutate({ id: b.id, status: "cancelled", reason });
                          }}
                          className="btn-ghost h-9 !px-3 text-xs"
                          disabled={changeStatus.isPending}
                        >
                          <X className="size-3.5" /> Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatDT(iso: string, timeZone?: string | null) {
  return formatInTZ(iso, timeZone || "America/Sao_Paulo", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
