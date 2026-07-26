import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Calendar, LogOut, Loader2, Clock, BarChart3, ExternalLink, Inbox, Settings, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { zonedDayRangeUTC } from "@/lib/timezone";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel · Slotly" },
      { name: "description", content: "Gerencie sua agenda, clientes e financeiro no Slotly." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, segment, timezone")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!isLoading && data && data.length === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, data, navigate]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    toast.success("Até já 👋");
  };

  if (isLoading || !data || data.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const company = data[0];
  return <DashboardContent company={company} signOut={signOut} />;
}

function DashboardContent({ company, signOut }: { company: { id: string; name: string; slug: string; segment: string; timezone?: string | null }; signOut: () => void }) {
  const tz = company.timezone || "America/Sao_Paulo";
  const { start: startOfDay, end: endOfDay } = zonedDayRangeUTC(new Date(), tz);

  const statsQ = useQuery({
    queryKey: ["dashboard-stats", company.id],
    queryFn: async () => {
      const [pending, today] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "pending"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "confirmed").gte("start_at", startOfDay.toISOString()).lte("start_at", endOfDay.toISOString()),
      ]);
      return { pending: pending.count ?? 0, today: today.count ?? 0 };
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative size-7 rounded-lg overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <Calendar className="size-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <span className="font-display text-lg font-semibold">Slotly</span>
          </Link>
          <button onClick={signOut} className="btn-ghost h-9 !px-3 text-sm">
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </header>

      <main className="container-page py-10 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{company.segment}</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">{company.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Link público:{" "}
              <a href={`/${company.slug}`} target="_blank" rel="noreferrer" className="text-foreground hover:underline inline-flex items-center gap-1">
                /{company.slug} <ExternalLink className="size-3.5" />
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/settings" className="btn-ghost h-11 text-sm">
              <Settings className="size-4" /> Configurações
            </Link>
            <Link to="/customers" className="btn-ghost h-11 text-sm">
              <Users className="size-4" /> Clientes
            </Link>
            <Link to="/calendar" className="btn-ghost h-11 text-sm">
              <Calendar className="size-4" /> Calendário
            </Link>
            <Link to="/bookings" className="btn-primary">
              <Inbox className="size-4" /> Ver agendamentos{statsQ.data?.pending ? ` (${statsQ.data.pending})` : ""}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat icon={Inbox} label="Aguardando aprovação" value={String(statsQ.data?.pending ?? 0)} />
          <Stat icon={Calendar} label="Confirmados para hoje" value={String(statsQ.data?.today ?? 0)} />
          <Stat icon={BarChart3} label="Faturamento do mês" value="R$ 0" />
        </div>

        <div className="surface-card p-8 text-center">
          <Clock className="size-8 mx-auto text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-semibold">Compartilhe seu link e receba agendamentos</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Envie o link <span className="text-foreground">/{company.slug}</span> para seus clientes. Cada solicitação aparece em <strong>Agendamentos</strong> para você aprovar.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${company.slug}`); toast.success("Link copiado"); }} className="btn-ghost h-9 text-sm">Copiar link</button>
            <Link to="/bookings" className="btn-primary h-9 text-sm">Abrir agendamentos</Link>
          </div>
        </div>
        <div className="pt-2 flex gap-4">
          <Link to="/settings" className="text-xs text-muted-foreground hover:text-foreground">Editar serviços, profissionais e horários</Link>
          <Link to="/customers" className="text-xs text-muted-foreground hover:text-foreground">Ver clientes e histórico</Link>
          <Link to="/onboarding" className="text-xs text-muted-foreground hover:text-foreground">Reabrir onboarding</Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
