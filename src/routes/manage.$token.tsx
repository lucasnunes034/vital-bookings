import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Phone,
  Mail,
  User,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  formatInTZ,
  getZonedParts,
  toZonedISODate,
  zonedDayOfWeek,
  zonedWallToUTC,
} from "@/lib/timezone";
import { computeSlots } from "@/lib/slots";
import { mapBookingError } from "@/lib/booking-errors";

type Booking = {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  company_id: string;
  company_name: string;
  company_slug: string;
  company_timezone: string | null;
  company_segment: string | null;
  company_phone: string | null;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  price_cents: number;
  professional_id: string;
  professional_name: string;
};

export const Route = createFileRoute("/manage/$token")({
  head: () => ({
    meta: [
      { title: "Gerenciar agendamento · Slotly" },
      { name: "description", content: "Cancele ou remarque seu agendamento em poucos cliques." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    // valida formato do token para não bater na RPC com lixo
    if (!/^[0-9a-f-]{36}$/i.test(params.token)) throw notFound();
    return { token: params.token };
  },
  errorComponent: () => <NotFound />,
  notFoundComponent: () => <NotFound />,
  component: ManagePage,
});

function ManagePage() {
  const { token } = Route.useLoaderData();
  const qc = useQueryClient();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewSent, setReviewSent] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);

  const bookingQ = useQuery({
    queryKey: ["manage-booking", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booking_by_token", { _token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("not_found");
      return row as Booking;
    },
    retry: false,
  });

  const b = bookingQ.data;
  const tz = b?.company_timezone || "America/Sao_Paulo";

  const availabilityQ = useQuery({
    enabled: !!b && !!date && rescheduleOpen,
    queryKey: ["manage-availability", b?.professional_id, date ? toZonedISODate(date, tz) : null, b?.id],
    queryFn: async () => {
      const dow = zonedDayOfWeek(date!, tz);
      const [avail, breaks, busy] = await Promise.all([
        supabase
          .from("professional_availability")
          .select("start_time, end_time")
          .eq("professional_id", b!.professional_id)
          .eq("day_of_week", dow),
        supabase
          .from("professional_breaks")
          .select("start_time, end_time")
          .eq("professional_id", b!.professional_id)
          .eq("day_of_week", dow),
        supabase.rpc("get_busy_slots", {
          _professional_id: b!.professional_id,
          _date: toZonedISODate(date!, tz),
          _timezone: tz,
        }),
      ]);
      if (avail.error) throw avail.error;
      if (breaks.error) throw breaks.error;
      if (busy.error) throw busy.error;
      // remover o próprio agendamento das ocupações para permitir escolher horário atual (edge)
      const busyFiltered = (busy.data as any[]).filter(
        (x) => new Date(x.start_at).toISOString() !== b!.start_at,
      );
      return { avail: avail.data, breaks: breaks.data, busy: busyFiltered };
    },
  });

  const slots = useMemo(() => {
    if (!availabilityQ.data || !b || !date) return [];
    return computeSlots({
      date,
      timeZone: tz,
      duration: b.duration_minutes,
      avail: availabilityQ.data.avail,
      breaks: availabilityQ.data.breaks,
      busy: availabilityQ.data.busy.map((x: any) => ({
        start: new Date(x.start_at),
        end: new Date(x.end_at),
      })),
    });
  }, [availabilityQ.data, b, date, tz]);

  const cancelMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_booking_by_token", {
        _token: token,
        _reason: cancelReason || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      setCancelOpen(false);
      setCancelReason("");
      qc.invalidateQueries({ queryKey: ["manage-booking", token] });
    },
    onError: (err: any) => {
      const m = mapBookingError(err, "cancel");
      toast.error(m.message, m.description ? { description: m.description } : undefined);
    },
  });

  const rescheduleMut = useMutation({
    mutationFn: async () => {
      if (!b || !date || !slot) throw new Error("Selecione data e horário.");
      const [h, m] = slot.split(":").map(Number);
      const p = getZonedParts(date, tz);
      const start = zonedWallToUTC(p.year, p.month, p.day, h, m, tz);
      const end = new Date(start.getTime() + b.duration_minutes * 60000);
      const { error } = await supabase.rpc("reschedule_booking_by_token", {
        _token: token,
        _new_start: start.toISOString(),
        _new_end: end.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento remarcado. Aguarde a confirmação.");
      setRescheduleOpen(false);
      setDate(undefined);
      setSlot(null);
      qc.invalidateQueries({ queryKey: ["manage-booking", token] });
    },
    onError: (err: any) => {
      const m = mapBookingError(err, "reschedule");
      if (m.kind === "conflict") {
        toast.error(m.message, { description: m.description });
        setSlot(null);
        availabilityQ.refetch();
        return;
      }
      toast.error(m.message, m.description ? { description: m.description } : undefined);
    },
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_review_by_token", {
        _token: token,
        _rating: rating,
        _comment: reviewComment.trim() || undefined,
        _customer_name: reviewName.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obrigado pela avaliação!");
      setReviewOpen(false);
      setReviewSent(true);
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("already_reviewed")) { toast.error("Este agendamento já foi avaliado."); setReviewSent(true); setReviewOpen(false); return; }
      if (msg.includes("not_completed") || msg.includes("too_early")) { toast.error("A avaliação estará disponível após o atendimento."); return; }
      const m = mapBookingError(err, "review");
      toast.error(m.message, m.description ? { description: m.description } : undefined);
    },
  });

  if (bookingQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (bookingQ.isError || !b) return <NotFound />;

  const start = new Date(b.start_at);
  const isPast = start < new Date();
  const canManage = (b.status === "pending" || b.status === "confirmed") && !isPast;
  const canReview = !reviewSent && isPast && (b.status === "confirmed" || b.status === "completed");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70">
        <div className="container-page flex h-16 items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.company_segment}</p>
            <h1 className="font-display text-lg font-semibold">{b.company_name}</h1>
          </div>
          <Link to="/$slug" params={{ slug: b.company_slug }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Página de agendamento
          </Link>
        </div>
      </header>

      <main className="container-page py-10 max-w-2xl">
        <StatusBanner status={b.status} isPast={isPast} />

        <section className="mt-6 surface-card p-6 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Serviço</p>
            <p className="font-display text-xl font-semibold mt-1">{b.service_name}</p>
            <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-2">
              <Clock className="size-3.5" /> {b.duration_minutes} min · {formatBRL(b.price_cents)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoRow icon={<CalendarIcon className="size-4" />} label="Quando">
              {formatInTZ(start, tz, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              <br />
              <span className="text-muted-foreground">
                às {formatInTZ(start, tz, { hour: "2-digit", minute: "2-digit" })}
              </span>
            </InfoRow>
            <InfoRow icon={<User className="size-4" />} label="Profissional">
              {b.professional_name}
            </InfoRow>
            <InfoRow icon={<User className="size-4" />} label="Em nome de">
              {b.customer_name}
            </InfoRow>
            <InfoRow icon={<Phone className="size-4" />} label="Contato">
              {b.customer_phone}
              {b.customer_email ? (
                <>
                  <br />
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Mail className="size-3" /> {b.customer_email}
                  </span>
                </>
              ) : null}
            </InfoRow>
          </div>

          {b.notes && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Observações</p>
              <p className="text-sm mt-1">{b.notes}</p>
            </div>
          )}
          {b.cancellation_reason && b.status === "cancelled" && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Motivo do cancelamento</p>
              <p className="text-sm mt-1">{b.cancellation_reason}</p>
            </div>
          )}
        </section>

        {canManage ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                setRescheduleOpen(true);
                setDate(undefined);
                setSlot(null);
              }}
              className="btn-primary"
            >
              <RefreshCw className="size-4" /> Remarcar
            </button>
            <button onClick={() => setCancelOpen(true)} className="btn-ghost">
              <XCircle className="size-4" /> Cancelar
            </button>
          </div>
        ) : canReview ? (
          <div className="mt-6 surface-card p-5 text-center">
            <Star className="size-8 mx-auto text-amber-400" />
            <p className="mt-2 font-medium">Como foi seu atendimento?</p>
            <p className="text-xs text-muted-foreground mt-1">Sua opinião ajuda outros clientes a escolher.</p>
            <button onClick={() => { setReviewName(b.customer_name); setReviewOpen(true); }} className="btn-primary mt-4 h-10 text-sm">
              Avaliar agora
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground text-center">
            {isPast
              ? "Este agendamento já ocorreu e não pode ser alterado."
              : "Este agendamento não pode mais ser alterado."}
          </p>
        )}

        {b.company_phone && canManage && (
          <p className="mt-6 text-xs text-muted-foreground text-center">
            Precisa de ajuda?{" "}
            <a href={`tel:${b.company_phone}`} className="text-foreground hover:underline">
              Falar com {b.company_name}
            </a>
          </p>
        )}
      </main>

      {/* Cancelar */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
            <DialogDescription>
              Você pode informar um motivo (opcional). Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex.: imprevisto pessoal"
            rows={3}
          />
          <DialogFooter>
            <button onClick={() => setCancelOpen(false)} className="btn-ghost">
              Voltar
            </button>
            <button
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
              className="btn-primary"
            >
              {cancelMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar cancelamento"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remarcar */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Remarcar agendamento</DialogTitle>
            <DialogDescription>
              Escolha uma nova data e horário. O estabelecimento receberá a nova solicitação para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="surface-card p-3">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setSlot(null);
                }}
                disabled={(d) => d < new Date(new Date().toDateString())}
              />
            </div>
            <div className="surface-card p-4 min-h-[280px]">
              {!date && <p className="text-sm text-muted-foreground">Selecione uma data.</p>}
              {date && availabilityQ.isLoading && (
                <div className="py-8 flex justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {date && !availabilityQ.isLoading && slots.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem horários disponíveis nesse dia.</p>
              )}
              {date && slots.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                        slot === s
                          ? "bg-foreground text-background border-foreground"
                          : "border-border hover:border-foreground/40 hover:bg-muted/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setRescheduleOpen(false)} className="btn-ghost">
              Voltar
            </button>
            <button
              onClick={() => rescheduleMut.mutate()}
              disabled={!date || !slot || rescheduleMut.isPending}
              className="btn-primary"
            >
              {rescheduleMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar novo horário"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avaliar */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar atendimento</DialogTitle>
            <DialogDescription>Sua avaliação ficará visível na página pública do estabelecimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                  <Star className={`size-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm">Seu nome (opcional)</label>
              <input value={reviewName} onChange={(e) => setReviewName(e.target.value)} className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm">Comentário (opcional)</label>
              <Textarea rows={4} maxLength={1000} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Como foi sua experiência?" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setReviewOpen(false)} className="btn-ghost">Cancelar</button>
            <button onClick={() => reviewMut.mutate()} disabled={reviewMut.isPending} className="btn-primary">
              {reviewMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enviar avaliação"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBanner({ status, isPast }: { status: Booking["status"]; isPast: boolean }) {
  const map: Record<Booking["status"], { label: string; tone: string; icon: React.ReactNode }> = {
    pending: {
      label: "Aguardando confirmação do estabelecimento",
      tone: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      icon: <Clock className="size-4" />,
    },
    confirmed: {
      label: isPast ? "Agendamento realizado" : "Agendamento confirmado",
      tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      icon: <CheckCircle2 className="size-4" />,
    },
    completed: {
      label: "Agendamento concluído",
      tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      icon: <CheckCircle2 className="size-4" />,
    },
    cancelled: {
      label: "Agendamento cancelado",
      tone: "bg-destructive/10 text-destructive border-destructive/30",
      icon: <XCircle className="size-4" />,
    },
  };
  const s = map[status];
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${s.tone}`}>
      {s.icon} {s.label}
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="text-sm mt-1">{children}</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center max-w-sm">
        <h1 className="font-display text-2xl font-semibold">Link inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link de gerenciamento não existe ou expirou. Confira se copiou o endereço completo.
        </p>
        <Link to="/" className="btn-ghost mt-6 inline-flex">
          Ir para o Slotly
        </Link>
      </div>
    </div>
  );
}

function mapRpcError(err: any): string {
  const msg = String(err?.message ?? "");
  if (msg.includes("not_found")) return "Agendamento não encontrado.";
  if (msg.includes("not_cancellable")) return "Este agendamento não pode mais ser cancelado.";
  if (msg.includes("not_reschedulable")) return "Este agendamento não pode mais ser remarcado.";
  if (msg.includes("past_booking")) return "Agendamentos passados não podem ser alterados.";
  if (msg.includes("invalid_new_time")) return "O novo horário precisa ser no futuro.";
  if (msg.includes("wrong_duration")) return "Duração do novo horário está diferente do serviço.";
  return msg || "Não foi possível concluir a operação.";
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}