import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Clock, ArrowLeft, CheckCircle2, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatInTZ,
  toZonedISODate,
  zonedDayOfWeek,
  zonedWallToUTC,
  getZonedParts,
} from "@/lib/timezone";
import { computeSlots } from "@/lib/slots";

export const Route = createFileRoute("/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Agende online · ${params.slug} · Slotly` },
      { name: "description", content: `Escolha um horário e agende online com ${params.slug}.` },
      { property: "og:title", content: `Agende com ${params.slug}` },
      { property: "og:description", content: "Escolha o serviço, o profissional e o melhor horário. Confirmação em instantes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug, segment, phone, timezone")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { company: data };
  },
  errorComponent: () => <NotAvailable />,
  notFoundComponent: () => <NotAvailable />,
  component: PublicBookingPage,
});

type Step = "service" | "professional" | "datetime" | "form" | "done";

const formSchema = z.object({
  customer_name: z.string().trim().min(2, "Informe seu nome").max(120, "Nome muito longo"),
  customer_phone: z.string().trim().min(8, "Telefone inválido").max(30, "Telefone muito longo"),
  customer_email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000, "Observações muito longas").optional(),
});

function PublicBookingPage() {
  const { company } = Route.useLoaderData();
  const tz = company.timezone || "America/Sao_Paulo";
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null); // "HH:mm"
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
  const [manageToken, setManageToken] = useState<string | null>(null);

  const servicesQ = useQuery({
    queryKey: ["public-services", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("company_id", company.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const professionalsQ = useQuery({
    queryKey: ["public-professionals", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, specialties, skill_level")
        .eq("company_id", company.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const service = servicesQ.data?.find((s) => s.id === serviceId) ?? null;
  const professional = professionalsQ.data?.find((p) => p.id === professionalId) ?? null;

  const availabilityQ = useQuery({
    enabled: !!professionalId && !!date,
    queryKey: ["public-availability", professionalId, date ? toZonedISODate(date, tz) : null],
    queryFn: async () => {
      const dow = zonedDayOfWeek(date!, tz);
      const [avail, breaks, busy] = await Promise.all([
        supabase
          .from("professional_availability")
          .select("start_time, end_time")
          .eq("professional_id", professionalId!)
          .eq("day_of_week", dow),
        supabase
          .from("professional_breaks")
          .select("start_time, end_time")
          .eq("professional_id", professionalId!)
          .eq("day_of_week", dow),
        supabase.rpc("get_busy_slots", {
          _professional_id: professionalId!,
          _date: toZonedISODate(date!, tz),
          _timezone: tz,
        }),
      ]);
      if (avail.error) throw avail.error;
      if (breaks.error) throw breaks.error;
      if (busy.error) throw busy.error;
      return { avail: avail.data, breaks: breaks.data, busy: busy.data };
    },
  });

  const slots = useMemo(() => {
    if (!availabilityQ.data || !service || !date) return [];
    return computeSlots({
      date,
      timeZone: tz,
      duration: service.duration_minutes,
      avail: availabilityQ.data.avail,
      breaks: availabilityQ.data.breaks,
      busy: availabilityQ.data.busy.map((b: any) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
    });
  }, [availabilityQ.data, service, date, tz]);

  const createBooking = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.parse(form);
      const [h, m] = slot!.split(":").map(Number);
      const p = getZonedParts(date!, tz);
      const start = zonedWallToUTC(p.year, p.month, p.day, h, m, tz);
      const end = new Date(start.getTime() + service!.duration_minutes * 60000);
      const { data, error } = await supabase.from("bookings").insert({
        company_id: company.id,
        professional_id: professionalId!,
        service_id: serviceId!,
        customer_name: parsed.customer_name,
        customer_phone: parsed.customer_phone,
        customer_email: parsed.customer_email || null,
        notes: parsed.notes || null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: "pending",
      }).select("manage_token").single();
      if (error) throw error;
      return data?.manage_token as string | undefined;
    },
    onSuccess: (token) => {
      setManageToken(token ?? null);
      setStep("done");
    },
    onError: (err: any) => {
      // 23P01 = exclusion_violation (bookings_no_overlap): outra pessoa reservou o mesmo horário.
      const code = err?.code ?? err?.details?.code;
      const msg = String(err?.message ?? "");
      if (code === "23P01" || msg.includes("bookings_no_overlap") || msg.toLowerCase().includes("exclusion")) {
        toast.error("Este horário acabou de ser reservado. Escolha outro, por favor.");
        // Volta ao passo de escolha de horário e força refetch dos slots
        setSlot(null);
        setStep("datetime");
        availabilityQ.refetch();
        return;
      }
      if (code === "42501" || msg.toLowerCase().includes("row-level security")) {
        toast.error("Não foi possível confirmar: verifique os dados e tente novamente.");
        return;
      }
      if (code === "23514") {
        toast.error("Dados inválidos. Revise nome, telefone, e-mail e observações.");
        return;
      }
      toast.error(msg || "Não foi possível agendar");
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{company.segment}</p>
            <h1 className="font-display text-lg font-semibold">{company.name}</h1>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Powered by Slotly</Link>
        </div>
      </header>

      <main className="container-page py-10 max-w-3xl">
        {step !== "done" && (
          <Progress step={step} />
        )}

        {step === "service" && (
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">Escolha o serviço</h2>
            {servicesQ.isLoading ? <Spinner /> : (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {servicesQ.data?.length === 0 && <EmptyMsg>Nenhum serviço disponível ainda.</EmptyMsg>}
                {servicesQ.data?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setServiceId(s.id); setStep("professional"); }}
                    className="surface-card p-5 text-left hover:border-foreground/30 transition-colors"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="size-3" /> {s.duration_minutes} min
                        </p>
                      </div>
                      <p className="font-display text-lg">{formatBRL(s.price_cents)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === "professional" && (
          <section className="mt-8">
            <BackButton onClick={() => setStep("service")} />
            <h2 className="font-display text-2xl font-semibold mt-2">Escolha o profissional</h2>
            {professionalsQ.isLoading ? <Spinner /> : (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {professionalsQ.data?.length === 0 && <EmptyMsg>Nenhum profissional disponível.</EmptyMsg>}
                {professionalsQ.data?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setProfessionalId(p.id); setStep("datetime"); }}
                    className="surface-card p-5 text-left hover:border-foreground/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.specialties?.length ? (
                          <p className="text-xs text-muted-foreground mt-0.5">{p.specialties.join(" · ")}</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === "datetime" && service && professional && (
          <section className="mt-8">
            <BackButton onClick={() => setStep("professional")} />
            <h2 className="font-display text-2xl font-semibold mt-2">Data e horário</h2>
            <p className="text-sm text-muted-foreground mt-1">{service.name} com {professional.name}</p>
            <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr]">
              <div className="surface-card p-3">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setSlot(null); }}
                  disabled={(d) => d < new Date(new Date().toDateString())}
                />
              </div>
              <div className="surface-card p-5 min-h-[320px]">
                {!date && <p className="text-sm text-muted-foreground">Selecione uma data para ver os horários disponíveis.</p>}
                {date && availabilityQ.isLoading && <Spinner />}
                {date && !availabilityQ.isLoading && slots.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem horários disponíveis nesse dia.</p>
                )}
                {date && slots.length > 0 && (
                  <>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Horários</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setSlot(s); setStep("form"); }}
                          className="h-10 rounded-md border border-border hover:border-foreground/40 hover:bg-muted/40 text-sm font-medium transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {step === "form" && service && professional && date && slot && (
          <section className="mt-8 max-w-xl">
            <BackButton onClick={() => setStep("datetime")} />
            <h2 className="font-display text-2xl font-semibold mt-2">Seus dados</h2>
            <div className="mt-4 surface-card p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span><CalendarIcon className="size-4 inline mr-1 text-muted-foreground" />{formatDate(date, tz)} às {slot}</span>
              <span>{service.name} · {service.duration_minutes} min · {formatBRL(service.price_cents)}</span>
              <span>com {professional.name}</span>
            </div>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => { e.preventDefault(); createBooking.mutate(); }}
            >
              <Field label="Nome completo" required>
                <Input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} required />
              </Field>
              <Field label="Telefone / WhatsApp" required>
                <Input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} required />
              </Field>
              <Field label="Email (opcional)">
                <Input type="email" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} />
              </Field>
              <Field label="Observações (opcional)">
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Alguma preferência ou detalhe" />
              </Field>
              <button type="submit" disabled={createBooking.isPending} className="btn-primary w-full">
                {createBooking.isPending ? <Loader2 className="size-4 animate-spin" /> : "Solicitar agendamento"}
              </button>
              <p className="text-xs text-muted-foreground text-center">Seu agendamento ficará pendente até o estabelecimento confirmar.</p>
            </form>
          </section>
        )}

        {step === "done" && service && professional && date && slot && (
          <section className="mt-16 text-center max-w-lg mx-auto">
            <div className="size-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-semibold">Solicitação enviada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {company.name} recebeu sua solicitação de <strong className="text-foreground">{service.name}</strong> em{" "}
              <strong className="text-foreground">{formatDate(date, tz)} às {slot}</strong> com {professional.name}. Você receberá a confirmação em breve.
            </p>
            {manageToken && (
              <div className="mt-8 surface-card p-5 text-left">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu link de gerenciamento</p>
                <p className="text-sm mt-2">
                  Salve este link para <strong>cancelar</strong> ou <strong>remarcar</strong> seu agendamento a qualquer momento — sem precisar criar conta.
                </p>
                <ManageLink token={manageToken} />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const idx = ["service", "professional", "datetime", "form"].indexOf(step);
  const labels = ["Serviço", "Profissional", "Data & hora", "Dados"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${i <= idx ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
          <span className={i <= idx ? "text-foreground" : "text-muted-foreground"}>{l}</span>
          {i < labels.length - 1 && <div className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
      <ArrowLeft className="size-4" /> Voltar
    </button>
  );
}

function Spinner() { return <div className="py-10 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>; }
function EmptyMsg({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }

function ManageLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const href = typeof window !== "undefined" ? `${window.location.origin}/manage/${token}` : `/manage/${token}`;
  return (
    <div className="mt-3 flex gap-2">
      <input
        readOnly
        value={href}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 h-10 px-3 rounded-md border border-border bg-muted/30 text-xs font-mono"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            toast.success("Link copiado");
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Não foi possível copiar");
          }
        }}
        className="btn-ghost h-10 shrink-0"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
      <a href={href} className="btn-ghost h-10 shrink-0" target="_blank" rel="noreferrer">
        Abrir
      </a>
    </div>
  );
}

function NotAvailable() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esse link de agendamento não existe ou está inativo.</p>
        <Link to="/" className="btn-ghost mt-6 inline-flex">Ir para o Slotly</Link>
      </div>
    </div>
  );
}

function formatBRL(cents: number) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d: Date, tz: string) {
  return formatInTZ(d, tz, { day: "2-digit", month: "long" });
}

