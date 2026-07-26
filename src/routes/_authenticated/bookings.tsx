import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  Check,
  X,
  Loader2,
  Clock,
  Phone,
  Mail,
  User,
  StickyNote,
  Search,
  Filter,
  RefreshCw,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  formatInTZ,
  getZonedParts,
  toZonedISODate,
  zonedDayOfWeek,
  zonedWallToUTC,
} from "@/lib/timezone";
import { computeSlots } from "@/lib/slots";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const [proFilter, setProFilter] = useState<string>("");
  const [svcFilter, setSvcFilter] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");

  const companyQ = useQuery({
    queryKey: ["my-company-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, slug, timezone").order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tz = companyQ.data?.timezone || "America/Sao_Paulo";

  const proQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["bk-pros", companyQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("id, name").eq("company_id", companyQ.data!.id).order("name");
      if (error) throw error;
      return data;
    },
  });
  const svcQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["bk-svcs", companyQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, duration_minutes, price_cents").eq("company_id", companyQ.data!.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  const bookingsQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["bookings", companyQ.data?.id, tab, from, to, proFilter, svcFilter],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, service:services(name, duration_minutes, price_cents), professional:professionals(name)")
        .eq("company_id", companyQ.data!.id)
        .eq("status", tab)
        .order("start_at", { ascending: tab === "pending" || tab === "confirmed" });
      if (proFilter) q = q.eq("professional_id", proFilter);
      if (svcFilter) q = q.eq("service_id", svcFilter);
      if (from) {
        const [y, mo, d] = from.split("-").map(Number);
        q = q.gte("start_at", zonedWallToUTC(y, mo, d, 0, 0, tz).toISOString());
      }
      if (to) {
        const [y, mo, d] = to.split("-").map(Number);
        q = q.lt("start_at", zonedWallToUTC(y, mo, d + 1, 0, 0, tz).toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return bookingsQ.data ?? [];
    return (bookingsQ.data ?? []).filter((b: any) =>
      [b.customer_name, b.customer_phone, b.customer_email].some((v: string | null) => v?.toLowerCase().includes(s))
    );
  }, [bookingsQ.data, search]);

  const detail = useMemo(
    () => (bookingsQ.data ?? []).find((b: any) => b.id === detailId) ?? null,
    [bookingsQ.data, detailId]
  );
  const rescheduling = useMemo(
    () => (bookingsQ.data ?? []).find((b: any) => b.id === rescheduleId) ?? null,
    [bookingsQ.data, rescheduleId]
  );

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
      setCancelId(null);
      setCancelReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const clearFilters = () => { setProFilter(""); setSvcFilter(""); setFrom(""); setTo(""); setSearch(""); };

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

        <div className="surface-card p-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground inline-flex items-center gap-1"><Search className="size-3" /> Cliente</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, telefone ou e-mail" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Profissional</Label>
            <select value={proFilter} onChange={(e) => setProFilter(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              {proQ.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Serviço</Label>
            <select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              {svcQ.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <button onClick={clearFilters} className="btn-ghost h-10 !px-3 text-xs inline-flex items-center gap-1">
            <Filter className="size-3.5" /> Limpar
          </button>
        </div>

        {bookingsQ.isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <CalendarIcon className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nada por aqui ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b: any) => (
              <div key={b.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground" />
                      <p className="font-medium">{formatDT(b.start_at, tz)}</p>
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
                    <button onClick={() => setDetailId(b.id)} className="btn-ghost h-9 !px-3 text-xs">
                      <Eye className="size-3.5" /> Detalhes
                    </button>
                    {(tab === "pending" || tab === "confirmed") && (
                      <button onClick={() => setRescheduleId(b.id)} className="btn-ghost h-9 !px-3 text-xs">
                        <RefreshCw className="size-3.5" /> Remarcar
                      </button>
                    )}
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
                          onClick={() => { setCancelId(b.id); setCancelReason(""); }}
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
                          onClick={() => { setCancelId(b.id); setCancelReason(""); }}
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

      <DetailsDialog booking={detail} tz={tz} onClose={() => setDetailId(null)} />
      <RescheduleDialog booking={rescheduling} tz={tz} onClose={() => setRescheduleId(null)} onDone={() => { setRescheduleId(null); qc.invalidateQueries({ queryKey: ["bookings"] }); }} />

      <Dialog open={!!cancelId} onOpenChange={(o) => { if (!o) { setCancelId(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
            <DialogDescription>Informe o motivo (opcional). O cliente poderá ver essa observação.</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento" rows={3} />
          <DialogFooter>
            <button onClick={() => { setCancelId(null); setCancelReason(""); }} className="btn-ghost h-9 !px-3 text-xs">Voltar</button>
            <button
              onClick={() => cancelId && changeStatus.mutate({ id: cancelId, status: "cancelled", reason: cancelReason || undefined })}
              className="btn-primary h-9 !px-3 text-xs"
              disabled={changeStatus.isPending}
            >
              {changeStatus.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Confirmar cancelamento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDT(iso: string, timeZone?: string | null) {
  return formatInTZ(iso, timeZone || "America/Sao_Paulo", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatBRL(cents?: number | null) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DetailsDialog({ booking, tz, onClose }: { booking: any; tz: string; onClose: () => void }) {
  const open = !!booking;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do agendamento</DialogTitle>
          <DialogDescription>Informações completas do cliente e do serviço.</DialogDescription>
        </DialogHeader>
        {booking && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Quando</p>
              <p className="font-medium">{formatInTZ(booking.start_at, tz, { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-xs text-muted-foreground">Duração: {booking.service?.duration_minutes} min · Valor: {formatBRL(booking.service?.price_cents)}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Serviço</p>
              <p>{booking.service?.name} — com {booking.professional?.name}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
              <p className="inline-flex items-center gap-2"><User className="size-3.5 text-muted-foreground" /> {booking.customer_name}</p>
              <a href={`tel:${booking.customer_phone}`} className="inline-flex items-center gap-2 hover:underline">
                <Phone className="size-3.5 text-muted-foreground" /> {booking.customer_phone}
              </a>
              <a href={`https://wa.me/${(booking.customer_phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">Abrir no WhatsApp</a>
              {booking.customer_email && (
                <a href={`mailto:${booking.customer_email}`} className="inline-flex items-center gap-2 hover:underline">
                  <Mail className="size-3.5 text-muted-foreground" /> {booking.customer_email}
                </a>
              )}
            </div>
            {booking.notes && (
              <div className="grid gap-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                <p className="whitespace-pre-wrap">{booking.notes}</p>
              </div>
            )}
            {booking.status === "cancelled" && booking.cancellation_reason && (
              <div className="grid gap-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Motivo do cancelamento</p>
                <p>{booking.cancellation_reason}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Criado em {formatInTZ(booking.created_at, tz, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        )}
        <DialogFooter>
          <button onClick={onClose} className="btn-ghost h-9 !px-3 text-xs">Fechar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ booking, tz, onClose, onDone }: { booking: any; tz: string; onClose: () => void; onDone: () => void }) {
  const open = !!booking;
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slot, setSlot] = useState<string | null>(null);

  // reset when opening a different booking
  useMemo(() => { setDate(undefined); setSlot(null); }, [booking?.id]);

  const availQ = useQuery({
    enabled: !!booking && !!date,
    queryKey: ["reschedule-avail", booking?.professional_id, date ? toZonedISODate(date, tz) : null],
    queryFn: async () => {
      const dow = zonedDayOfWeek(date!, tz);
      const [avail, breaks, busy] = await Promise.all([
        supabase.from("professional_availability").select("start_time, end_time").eq("professional_id", booking.professional_id).eq("day_of_week", dow),
        supabase.from("professional_breaks").select("start_time, end_time").eq("professional_id", booking.professional_id).eq("day_of_week", dow),
        supabase.rpc("get_busy_slots", { _professional_id: booking.professional_id, _date: toZonedISODate(date!, tz), _timezone: tz }),
      ]);
      if (avail.error) throw avail.error;
      if (breaks.error) throw breaks.error;
      if (busy.error) throw busy.error;
      // exclui o próprio agendamento das ocupações
      const busyFiltered = (busy.data as any[]).filter((b) => new Date(b.start_at).toISOString() !== booking.start_at);
      return {
        avail: avail.data as any[],
        breaks: breaks.data as any[],
        busy: busyFiltered.map((b: any) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      };
    },
  });

  const slots = useMemo(() => {
    if (!availQ.data || !booking || !date) return [];
    return computeSlots({
      date, timeZone: tz,
      duration: booking.service?.duration_minutes ?? 30,
      avail: availQ.data.avail, breaks: availQ.data.breaks, busy: availQ.data.busy,
    });
  }, [availQ.data, booking, date, tz]);

  const save = useMutation({
    mutationFn: async () => {
      if (!booking || !date || !slot) throw new Error("Escolha data e horário");
      const [h, m] = slot.split(":").map(Number);
      const p = getZonedParts(date, tz);
      const start = zonedWallToUTC(p.year, p.month, p.day, h, m, tz);
      const end = new Date(start.getTime() + (booking.service?.duration_minutes ?? 30) * 60000);
      const { error } = await supabase.from("bookings").update({ start_at: start.toISOString(), end_at: end.toISOString() }).eq("id", booking.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agendamento remarcado"); onDone(); },
    onError: (e: any) => {
      if (e?.code === "23P01") { toast.error("Esse horário conflita com outro agendamento"); setSlot(null); }
      else toast.error(e?.message ?? "Erro ao remarcar");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Remarcar agendamento</DialogTitle>
          <DialogDescription>
            {booking && <>Atual: {formatInTZ(booking.start_at, tz, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {booking.customer_name}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div>
            <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setSlot(null); }} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Horários disponíveis</p>
            {!date ? (
              <p className="text-sm text-muted-foreground">Escolha uma data.</p>
            ) : availQ.isLoading ? (
              <div className="py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem horários livres nesse dia.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button key={s} onClick={() => setSlot(s)} className={`h-9 px-3 rounded-md border text-sm ${slot === s ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent"}`}>{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="btn-ghost h-9 !px-3 text-xs">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!slot || save.isPending} className="btn-primary h-9 !px-3 text-xs">
            {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Confirmar remarcação
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
