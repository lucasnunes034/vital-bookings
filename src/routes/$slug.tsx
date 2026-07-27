import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  User,
  Star,
  Share2,
  MapPin,
  Phone,
  Globe,
  Instagram,
  Facebook,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShareDialog } from "@/components/share-dialog";
import {
  formatInTZ,
  toZonedISODate,
  zonedDayOfWeek,
  zonedWallToUTC,
  getZonedParts,
} from "@/lib/timezone";
import { computeSlots } from "@/lib/slots";
import { mapBookingError } from "@/lib/booking-errors";

type PublicCompany = {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  phone: string | null;
  timezone: string | null;
  logo_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  whatsapp_phone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  business_hours: Record<string, { open: string; close: string }[]> | null;
  gallery: { url: string; caption?: string | null }[] | null;
  reviews_avg: number | null;
  reviews_count: number | null;
  services: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
    photo_url: string | null;
    display_order: number | null;
  }[];
  professionals: {
    id: string;
    name: string;
    photo_url: string | null;
    bio: string | null;
    specialties: string[] | null;
    display_order: number | null;
  }[];
  reviews: {
    id: string;
    customer_name: string;
    rating: number;
    comment: string | null;
    created_at: string;
    professional_id: string | null;
  }[];
};

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
    const { data, error } = await supabase.rpc("get_public_company_by_slug", { _slug: params.slug });
    if (error) throw error;
    if (!data) throw notFound();
    return { company: data as unknown as PublicCompany };
  },
  errorComponent: () => <NotAvailable />,
  notFoundComponent: () => <NotAvailable />,
  component: PublicLandingPage,
});

type Step = "service" | "professional" | "datetime" | "form" | "done";

const formSchema = z.object({
  customer_name: z.string().trim().min(2, "Informe seu nome").max(120, "Nome muito longo"),
  customer_phone: z.string().trim().min(8, "Telefone inválido").max(30, "Telefone muito longo"),
  customer_email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

function PublicLandingPage() {
  const { company } = Route.useLoaderData();
  const tz = company.timezone || "America/Sao_Paulo";
  const [bookingOpen, setBookingOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [preservice, setPreservice] = useState<string | null>(null);
  const [preprof, setPreprof] = useState<string | null>(null);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${company.slug}` : `/${company.slug}`;
  const rating = Number(company.reviews_avg ?? 0);
  const reviewsCount = Number(company.reviews_count ?? 0);
  const addressLine = [company.address, company.city, company.state].filter(Boolean).join(", ");
  const hasContact = addressLine || company.whatsapp_phone || company.phone || company.instagram_url || company.facebook_url || company.website_url;

  const openBooking = (sid?: string | null, pid?: string | null) => {
    setPreservice(sid ?? null);
    setPreprof(pid ?? null);
    setBookingOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {company.logo_url && <img src={company.logo_url} alt="" className="size-9 rounded-lg object-cover border border-border" />}
            <div className="min-w-0">
              {company.segment && <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{company.segment}</p>}
              <h1 className="font-display text-base sm:text-lg font-semibold truncate">{company.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShareOpen(true)} className="btn-ghost h-9 !px-3 text-sm">
              <Share2 className="size-4" /> <span className="hidden sm:inline">Compartilhar</span>
            </button>
            <button onClick={() => openBooking()} className="btn-primary h-9 !px-4 text-sm">Agendar</button>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="relative w-full aspect-[16/7] sm:aspect-[16/6] overflow-hidden bg-muted">
          {company.cover_url ? (
            <img src={company.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "var(--gradient-brand, linear-gradient(135deg,#111,#333))" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        <div className="container-page relative -mt-20 sm:-mt-24 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
            <div className="size-24 sm:size-32 rounded-2xl overflow-hidden border-4 border-background bg-muted shrink-0 shadow-xl">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted"><Sparkles className="size-10 text-muted-foreground" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">{company.name}</h2>
              {company.tagline && <p className="mt-1 text-base text-muted-foreground">{company.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {reviewsCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Stars value={rating} /><span className="font-medium">{rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({reviewsCount})</span>
                  </span>
                )}
                {addressLine && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" /> {addressLine}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <button onClick={() => openBooking()} className="btn-primary h-11 !px-6">
                <CalendarIcon className="size-4" /> Agendar agora
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="container-page pb-20 space-y-14">
        {company.description && (
          <section>
            <h3 className="font-display text-xl font-semibold mb-3">Sobre</h3>
            <p className="text-sm sm:text-base text-muted-foreground whitespace-pre-line leading-relaxed max-w-3xl">{company.description}</p>
          </section>
        )}

        {company.services.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold">Serviços</h3>
              <span className="text-xs text-muted-foreground">{company.services.length} disponíveis</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {company.services.map((s: PublicCompany["services"][number]) => (
                <button
                  key={s.id}
                  onClick={() => openBooking(s.id)}
                  className="surface-card overflow-hidden text-left hover:border-foreground/30 transition-colors group"
                >
                  {s.photo_url && (
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="size-3" /> {s.duration_minutes} min
                        </p>
                      </div>
                      <p className="font-display text-lg shrink-0">{formatBRL(s.price_cents)}</p>
                    </div>
                    {s.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {company.professionals.length > 0 && (
          <section>
            <h3 className="font-display text-xl font-semibold mb-4">Nossa equipe</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {company.professionals.map((p: PublicCompany["professionals"][number]) => (
                <button
                  key={p.id}
                  onClick={() => openBooking(null, p.id)}
                  className="surface-card p-4 text-center hover:border-foreground/30 transition-colors"
                >
                  <div className="size-24 mx-auto rounded-full overflow-hidden bg-muted mb-3 border border-border">
                    {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="size-10 text-muted-foreground" /></div>}
                  </div>
                  <p className="font-medium">{p.name}</p>
                  {p.specialties?.length ? <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.specialties.join(" · ")}</p> : null}
                  {p.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{p.bio}</p>}
                </button>
              ))}
            </div>
          </section>
        )}

        {company.gallery && company.gallery.length > 0 && (
          <section>
            <h3 className="font-display text-xl font-semibold mb-4">Galeria</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {company.gallery.map((g: NonNullable<PublicCompany["gallery"]>[number], i: number) => (
                <a key={i} href={g.url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-muted border border-border hover:border-foreground/30 transition-colors block">
                  <img src={g.url} alt={g.caption ?? ""} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          {company.business_hours && Object.keys(company.business_hours).length > 0 && (
            <div className="surface-card p-5">
              <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2"><Clock className="size-4" /> Horário de funcionamento</h3>
              <BusinessHoursList hours={company.business_hours} />
            </div>
          )}
          {hasContact && (
            <div className="surface-card p-5 space-y-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2"><MapPin className="size-4" /> Contato & localização</h3>
              {addressLine && <p className="text-sm">{addressLine}{company.postal_code ? ` · CEP ${company.postal_code}` : ""}</p>}
              <div className="flex flex-wrap gap-2">
                {company.whatsapp_phone && <a href={`https://wa.me/${company.whatsapp_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-ghost h-9 !px-3 text-sm"><MessageCircle className="size-4 text-emerald-500" /> WhatsApp</a>}
                {company.phone && <a href={`tel:${company.phone}`} className="btn-ghost h-9 !px-3 text-sm"><Phone className="size-4" /> {company.phone}</a>}
                {company.instagram_url && <a href={company.instagram_url} target="_blank" rel="noreferrer" className="btn-ghost h-9 !px-3 text-sm"><Instagram className="size-4 text-pink-500" /> Instagram</a>}
                {company.facebook_url && <a href={company.facebook_url} target="_blank" rel="noreferrer" className="btn-ghost h-9 !px-3 text-sm"><Facebook className="size-4 text-blue-500" /> Facebook</a>}
                {company.website_url && <a href={company.website_url} target="_blank" rel="noreferrer" className="btn-ghost h-9 !px-3 text-sm"><Globe className="size-4" /> Site</a>}
              </div>
              {addressLine && (
                <div className="rounded-lg overflow-hidden border border-border aspect-[16/9] bg-muted">
                  <iframe title="Mapa" src={`https://www.google.com/maps?q=${encodeURIComponent(addressLine)}&output=embed`} className="w-full h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              )}
            </div>
          )}
        </section>

        {company.reviews.length > 0 && (
          <section>
            <div className="flex items-baseline gap-3 mb-4">
              <h3 className="font-display text-xl font-semibold">Avaliações</h3>
              <span className="text-sm text-muted-foreground inline-flex items-center gap-1"><Stars value={rating} /> {rating.toFixed(1)} · {reviewsCount}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {company.reviews.slice(0, 9).map((r: PublicCompany["reviews"][number]) => (
                <div key={r.id} className="surface-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{r.customer_name}</p>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-muted-foreground line-clamp-4">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{formatInTZ(new Date(r.created_at), tz, { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="surface-card p-8 text-center">
          <h3 className="font-display text-2xl font-semibold">Pronto para agendar?</h3>
          <p className="mt-2 text-sm text-muted-foreground">Escolha serviço, profissional e horário em menos de 1 minuto.</p>
          <button onClick={() => openBooking()} className="btn-primary h-11 !px-6 mt-5"><CalendarIcon className="size-4" /> Agendar agora</button>
        </section>

        <footer className="pt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Powered by Slotly</Link>
        </footer>
      </main>

      <BookingDialog
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        company={company}
        initialServiceId={preservice}
        initialProfessionalId={preprof}
      />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={company.name} />
    </div>
  );
}

function BookingDialog({
  open, onClose, company, initialServiceId, initialProfessionalId,
}: {
  open: boolean;
  onClose: () => void;
  company: PublicCompany;
  initialServiceId: string | null;
  initialProfessionalId: string | null;
}) {
  const tz = company.timezone || "America/Sao_Paulo";
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
  const [manageToken, setManageToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServiceId(initialServiceId);
    setProfessionalId(initialProfessionalId);
    setDate(undefined);
    setSlot(null);
    setManageToken(null);
    setForm({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
    setStep(initialServiceId ? (initialProfessionalId ? "datetime" : "professional") : "service");
  }, [open, initialServiceId, initialProfessionalId]);

  const service = company.services.find((s) => s.id === serviceId) ?? null;
  const professional = company.professionals.find((p) => p.id === professionalId) ?? null;

  const availabilityQ = useQuery({
    enabled: open && !!professionalId && !!date,
    queryKey: ["public-availability", professionalId, date ? toZonedISODate(date, tz) : null],
    queryFn: async () => {
      const dow = zonedDayOfWeek(date!, tz);
      const [avail, breaks, busy] = await Promise.all([
        supabase.from("professional_availability").select("start_time, end_time").eq("professional_id", professionalId!).eq("day_of_week", dow),
        supabase.from("professional_breaks").select("start_time, end_time").eq("professional_id", professionalId!).eq("day_of_week", dow),
        supabase.rpc("get_busy_slots", { _professional_id: professionalId!, _date: toZonedISODate(date!, tz), _timezone: tz }),
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
      date, timeZone: tz, duration: service.duration_minutes,
      avail: availabilityQ.data.avail, breaks: availabilityQ.data.breaks,
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
    onSuccess: (token) => { setManageToken(token ?? null); setStep("done"); },
    onError: (err: any) => {
      const code = err?.code ?? err?.details?.code;
      const msg = String(err?.message ?? "");
      if (code === "23P01" || msg.includes("bookings_no_overlap") || msg.toLowerCase().includes("exclusion")) {
        toast.error("Este horário acabou de ser reservado. Escolha outro, por favor.");
        setSlot(null); setStep("datetime"); availabilityQ.refetch(); return;
      }
      if (code === "42501" || msg.toLowerCase().includes("row-level security")) {
        toast.error("Não foi possível confirmar: verifique os dados e tente novamente."); return;
      }
      if (code === "23514") { toast.error("Dados inválidos. Revise nome, telefone, e-mail e observações."); return; }
      toast.error(msg || "Não foi possível agendar");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar em {company.name}</DialogTitle>
        </DialogHeader>
        {step !== "done" && <Progress step={step} />}

        {step === "service" && (
          <section className="mt-4">
            <h2 className="font-display text-lg font-semibold">Escolha o serviço</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {company.services.length === 0 && <EmptyMsg>Nenhum serviço disponível.</EmptyMsg>}
              {company.services.map((s: PublicCompany["services"][number]) => (
                <button key={s.id} onClick={() => { setServiceId(s.id); setStep("professional"); }} className="surface-card p-4 text-left hover:border-foreground/30 transition-colors">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="size-3" /> {s.duration_minutes} min</p>
                    </div>
                    <p className="font-display text-lg">{formatBRL(s.price_cents)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "professional" && (
          <section className="mt-4">
            <BackButton onClick={() => setStep("service")} />
            <h2 className="font-display text-lg font-semibold mt-2">Escolha o profissional</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {company.professionals.length === 0 && <EmptyMsg>Nenhum profissional disponível.</EmptyMsg>}
              {company.professionals.map((p: PublicCompany["professionals"][number]) => (
                <button key={p.id} onClick={() => { setProfessionalId(p.id); setStep("datetime"); }} className="surface-card p-4 text-left hover:border-foreground/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <User className="size-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.specialties?.length ? <p className="text-xs text-muted-foreground mt-0.5">{p.specialties.join(" · ")}</p> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "datetime" && service && professional && (
          <section className="mt-4">
            <BackButton onClick={() => setStep(initialServiceId ? "service" : "professional")} />
            <h2 className="font-display text-lg font-semibold mt-2">Data e horário</h2>
            <p className="text-sm text-muted-foreground mt-1">{service.name} com {professional.name}</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
              <div className="surface-card p-3">
                <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setSlot(null); }} disabled={(d) => d < new Date(new Date().toDateString())} />
              </div>
              <div className="surface-card p-4 min-h-[280px]">
                {!date && <p className="text-sm text-muted-foreground">Selecione uma data.</p>}
                {date && availabilityQ.isLoading && <Spinner />}
                {date && !availabilityQ.isLoading && slots.length === 0 && <p className="text-sm text-muted-foreground">Sem horários disponíveis nesse dia.</p>}
                {date && slots.length > 0 && (
                  <>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Horários</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button key={s} onClick={() => { setSlot(s); setStep("form"); }} className="h-10 rounded-md border border-border hover:border-foreground/40 hover:bg-muted/40 text-sm font-medium transition-colors">{s}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {step === "form" && service && professional && date && slot && (
          <section className="mt-4 max-w-xl">
            <BackButton onClick={() => setStep("datetime")} />
            <h2 className="font-display text-lg font-semibold mt-2">Seus dados</h2>
            <div className="mt-3 surface-card p-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span><CalendarIcon className="size-4 inline mr-1 text-muted-foreground" />{formatDate(date, tz)} às {slot}</span>
              <span>{service.name} · {service.duration_minutes} min · {formatBRL(service.price_cents)}</span>
              <span>com {professional.name}</span>
            </div>
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); createBooking.mutate(); }}>
              <Field label="Nome completo" required><Input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} required /></Field>
              <Field label="Telefone / WhatsApp" required><Input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} required /></Field>
              <Field label="Email (opcional)"><Input type="email" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} /></Field>
              <Field label="Observações (opcional)"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Alguma preferência ou detalhe" /></Field>
              <button type="submit" disabled={createBooking.isPending} className="btn-primary w-full">
                {createBooking.isPending ? <Loader2 className="size-4 animate-spin" /> : "Solicitar agendamento"}
              </button>
              <p className="text-xs text-muted-foreground text-center">Seu agendamento ficará pendente até o estabelecimento confirmar.</p>
            </form>
          </section>
        )}

        {step === "done" && service && professional && date && slot && (
          <section className="mt-6 text-center max-w-lg mx-auto pb-4">
            <div className="size-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="size-8 text-emerald-500" /></div>
            <h2 className="mt-6 font-display text-2xl font-semibold">Solicitação enviada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {company.name} recebeu sua solicitação de <strong className="text-foreground">{service.name}</strong> em{" "}
              <strong className="text-foreground">{formatDate(date, tz)} às {slot}</strong> com {professional.name}. Você receberá a confirmação em breve.
            </p>
            {manageToken && (
              <div className="mt-6 surface-card p-4 text-left">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu link de gerenciamento</p>
                <p className="text-sm mt-2">Salve este link para <strong>cancelar</strong> ou <strong>remarcar</strong> a qualquer momento — sem criar conta.</p>
                <ManageLink token={manageToken} />
              </div>
            )}
            <button onClick={onClose} className="btn-ghost mt-6 h-10 text-sm">Fechar</button>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- helpers ---------- */

function Progress({ step }: { step: Step }) {
  const idx = ["service", "professional", "datetime", "form"].indexOf(step);
  const labels = ["Serviço", "Profissional", "Data & hora", "Dados"];
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
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
      <input readOnly value={href} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 h-10 px-3 rounded-md border border-border bg-muted/30 text-xs font-mono" />
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(href); setCopied(true); toast.success("Link copiado"); setTimeout(() => setCopied(false), 1500); }
          catch { toast.error("Não foi possível copiar"); }
        }}
        className="btn-ghost h-10 shrink-0"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
      <a href={href} className="btn-ghost h-10 shrink-0" target="_blank" rel="noreferrer">Abrir</a>
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

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-3.5 ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function BusinessHoursList({ hours }: { hours: Record<string, { open: string; close: string }[]> }) {
  return (
    <ul className="text-sm space-y-1">
      {DAY_LABELS.map((label, i) => {
        const arr = hours[String(i)] || [];
        return (
          <li key={i} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{arr.length === 0 ? "Fechado" : arr.map((h) => `${h.open}–${h.close}`).join(" · ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function formatBRL(cents: number) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d: Date, tz: string) { return formatInTZ(d, tz, { day: "2-digit", month: "long" }); }