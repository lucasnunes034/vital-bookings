import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Calendar, LogOut, Loader2, Clock, BarChart3, ExternalLink, Inbox, Settings, Users, Bell, Repeat, MessageCircle, FileText } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { zonedDayRangeUTC, formatInTZ } from "@/lib/timezone";
import { WhatsappMenu } from "@/components/whatsapp-actions";
import { buildWhatsappUrl } from "@/lib/whatsapp";

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
        .select("id, name, slug, segment, timezone, address")
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

function DashboardContent({ company, signOut }: { company: { id: string; name: string; slug: string; segment: string; timezone?: string | null; address?: string | null }; signOut: () => void }) {
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
          <div className="flex items-center gap-2">
            <Link to="/settings" className="btn-ghost size-9" aria-label="Configurações">
              <Settings className="size-5" />
            </Link>
            <button onClick={signOut} className="btn-ghost h-9 !px-3 text-sm">
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container-page py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{company.segment}</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">{company.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Link público:{" "}
              <a href={`/${company.slug}`} target="_blank" rel="noreferrer" className="text-foreground hover:underline inline-flex items-center gap-1">
                /{company.slug} <ExternalLink className="size-3.5" />
              </a>
            </p>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2 w-full md:w-auto -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:pb-0">
            <Link to="/customers" className="btn-ghost h-11 text-sm">
              <Users className="size-4" /> Clientes
            </Link>
            <Link to="/quotes" className="btn-ghost h-11 text-sm">
              <FileText className="size-4" /> Orçamentos
            </Link>
            <Link to="/calendar" className="btn-ghost h-11 text-sm">
              <Calendar className="size-4" /> Calendário
            </Link>
            <Link to="/bookings" className="btn-primary shrink-0">
              <Inbox className="size-4" /> Ver agendamentos{statsQ.data?.pending ? ` (${statsQ.data.pending})` : ""}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat icon={Inbox} label="Aguardando aprovação" value={String(statsQ.data?.pending ?? 0)} />
          <Stat icon={Calendar} label="Confirmados para hoje" value={String(statsQ.data?.today ?? 0)} />
          <Stat icon={BarChart3} label="Faturamento do mês" value="R$ 0" />
        </div>

        <RemindersCard company={company} />

        <ReturnOpportunitiesCard company={company} />

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

function RemindersCard({ company }: { company: { id: string; name: string; timezone?: string | null; address?: string | null; slug?: string | null } }) {
  const tz = company.timezone || "America/Sao_Paulo";
  const now = new Date();
  // Janela: próximos 26 horas (pega tanto 24h quanto 1h)
  const fromISO = now.toISOString();
  const toISO = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();

  const q = useQuery({
    queryKey: ["reminders-queue", company.id, Math.floor(now.getTime() / (5 * 60 * 1000))],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, status, start_at, customer_name, customer_phone, manage_token, reminder_24h_sent_at, reminder_1h_sent_at, service:services(name, duration_minutes, price_cents), professional:professionals(name)")
        .eq("company_id", company.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_at", fromISO)
        .lte("start_at", toISO)
        .order("start_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const rows = (q.data ?? []).map((b: any) => {
    const startMs = new Date(b.start_at).getTime();
    const diffMin = (startMs - Date.now()) / 60000;
    // 1h window: 30–90 min antes; 24h window: 22–26h antes
    const due1h = diffMin > 30 && diffMin < 90 && !b.reminder_1h_sent_at;
    const due24h = diffMin > 22 * 60 && diffMin < 26 * 60 && !b.reminder_24h_sent_at;
    return { b, due1h, due24h };
  }).filter((r) => r.due1h || r.due24h);

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="font-medium">Lembretes pendentes</h2>
          <span className="text-xs text-muted-foreground">— envie por WhatsApp em 1 clique</span>
        </div>
        <Link to="/settings" search={{ tab: "messages" }} className="text-xs text-muted-foreground hover:text-foreground">
          Personalizar mensagens
        </Link>
      </div>
      {q.isLoading ? (
        <div className="py-6 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lembrete pendente agora. Vamos avisar você quando um agendamento se aproximar.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map(({ b, due1h, due24h }) => (
            <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {formatInTZ(b.start_at, tz, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {b.customer_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {b.service?.name} · {b.professional?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border ${due1h ? "bg-primary/10 border-primary/40" : "bg-muted border-border"}`}>
                  {due1h ? "1h antes" : "24h antes"}
                </span>
                <WhatsappMenu booking={b} company={company} markReminder />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ReturnRow = {
  key: string;
  customer_name: string;
  customer_phone: string | null;
  service_name: string;
  last_at: string;
  daysOverdue: number;
  intervalDays: number;
};

function overdueLabel(days: number): string {
  if (days < 30) return `${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}a ${rem}m` : `${years} ${years === 1 ? "ano" : "anos"}`;
}

function returnMessage(customer: string, service: string, companyName: string) {
  return `Olá ${customer}! 👋\n\nAqui é da *${companyName}*. Passou um tempinho desde o último *${service}* — que tal já garantir um novo horário? Posso te enviar as opções disponíveis. 😉`;
}

function ReturnOpportunitiesCard({ company }: { company: { id: string; name: string; timezone?: string | null; slug?: string | null } }) {
  const tz = company.timezone || "America/Sao_Paulo";
  // Serviços recorrentes típicos (higienização, limpeza, manutenção) sugerem ~90 dias.
  const RECURRENCE_DAYS = 90;

  const q = useQuery({
    queryKey: ["return-opportunities", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_at, status, customer_name, customer_phone, service:services(name)")
        .eq("company_id", company.id)
        .in("status", ["confirmed", "completed"])
        .lt("start_at", new Date().toISOString())
        .order("start_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows: ReturnRow[] = (() => {
    const seen = new Map<string, ReturnRow>();
    for (const b of (q.data ?? []) as any[]) {
      const key = (b.customer_phone || "").replace(/\D/g, "") || `name:${b.customer_name?.toLowerCase()}`;
      if (!key || seen.has(key)) continue;
      const last = new Date(b.start_at).getTime();
      const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
      if (days < RECURRENCE_DAYS) continue;
      seen.set(key, {
        key,
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        service_name: b.service?.name ?? "Serviço",
        last_at: b.start_at,
        daysOverdue: days - RECURRENCE_DAYS,
        intervalDays: days,
      });
    }
    return Array.from(seen.values())
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 20);
  })();

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <h2 className="font-medium">Oportunidades de retorno</h2>
          <span className="text-xs text-muted-foreground">— clientes que já passaram do ciclo de {RECURRENCE_DAYS} dias</span>
        </div>
      </div>
      {q.isLoading ? (
        <div className="py-6 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há clientes vencidos. Assim que alguém passar de {RECURRENCE_DAYS} dias sem retornar, aparece aqui pronto para contato.
        </p>
      ) : (
        <>
        <div className="hidden md:block overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">Serviço anterior</th>
                <th className="py-2 pr-3 font-medium">Último atendimento</th>
                <th className="py-2 pr-3 font-medium">Tempo vencido</th>
                <th className="py-2 pr-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => {
                const url = buildWhatsappUrl(r.customer_phone, returnMessage(r.customer_name, r.service_name, company.name));
                const hasPhone = !!(r.customer_phone && r.customer_phone.replace(/\D/g, ""));
                const overdue = r.daysOverdue;
                const tone = overdue >= 90 ? "bg-destructive/10 text-destructive border-destructive/30" : overdue >= 30 ? "bg-warning/10 text-warning border-warning/30" : "bg-muted text-muted-foreground border-border";
                return (
                  <tr key={r.key} className="hover:bg-accent/40">
                    <td className="py-3 pr-3">
                      <p className="font-medium truncate">{r.customer_name}</p>
                      {r.customer_phone && <p className="text-xs text-muted-foreground">{r.customer_phone}</p>}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{r.service_name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {formatInTZ(r.last_at, tz, { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-md border ${tone}`}>
                        {overdueLabel(overdue)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {hasPhone ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white shadow-sm transition hover:opacity-90"
                          style={{ backgroundColor: "#25D366" }}
                          title="Oferecer novo agendamento via WhatsApp"
                        >
                          <MessageCircle className="size-3.5" /> WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem telefone</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {rows.map((r) => {
            const url = buildWhatsappUrl(r.customer_phone, returnMessage(r.customer_name, r.service_name, company.name));
            const hasPhone = !!(r.customer_phone && r.customer_phone.replace(/\D/g, ""));
            const overdue = r.daysOverdue;
            const tone = overdue >= 90 ? "bg-destructive/10 text-destructive border-destructive/30" : overdue >= 30 ? "bg-warning/10 text-warning border-warning/30" : "bg-muted text-muted-foreground border-border";
            return (
              <div key={r.key} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.customer_name}</p>
                    {r.customer_phone && <p className="text-xs text-muted-foreground truncate">{r.customer_phone}</p>}
                  </div>
                  <span className={`shrink-0 inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border ${tone}`}>
                    {overdueLabel(overdue)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><span className="text-foreground">{r.service_name}</span></p>
                  <p>Último: {formatInTZ(r.last_at, tz, { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                {hasPhone ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 h-12 px-4 rounded-md text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageCircle className="size-4" /> Oferecer via WhatsApp
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem telefone cadastrado</p>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
