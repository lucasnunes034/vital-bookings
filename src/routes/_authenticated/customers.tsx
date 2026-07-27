import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Search,
  Users,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  Clock,
  StickyNote,
  Repeat,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatInTZ } from "@/lib/timezone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Status = "pending" | "confirmed" | "cancelled" | "completed";

type BookingRow = {
  id: string;
  status: Status;
  start_at: string;
  end_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  service: { name: string | null; duration_minutes: number | null; price_cents: number | null } | null;
  professional: { name: string | null } | null;
};

type Customer = {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  total: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  lastVisit: string | null;
  nextVisit: string | null;
  totalSpentCents: number;
  bookings: BookingRow[];
};

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Clientes · Slotly" },
      { name: "description", content: "Histórico completo dos seus clientes, com recorrência e última visita." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomersPage,
});

function normalizePhone(p: string | null | undefined) {
  return (p || "").replace(/\D/g, "");
}

function customerKey(b: BookingRow) {
  const phone = normalizePhone(b.customer_phone);
  if (phone) return `p:${phone}`;
  const email = (b.customer_email || "").trim().toLowerCase();
  if (email) return `e:${email}`;
  return `n:${(b.customer_name || "sem-nome").trim().toLowerCase()}`;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<Status, string> = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  completed: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);

  const companyQ = useQuery({
    queryKey: ["my-company-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, timezone")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tz = companyQ.data?.timezone || "America/Sao_Paulo";

  const bookingsQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["customers-bookings", companyQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, status, start_at, end_at, customer_name, customer_phone, customer_email, notes, cancellation_reason, service:services(name, duration_minutes, price_cents), professional:professionals(name)"
        )
        .eq("company_id", companyQ.data!.id)
        .order("start_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  const customers = useMemo<Customer[]>(() => {
    const list = bookingsQ.data ?? [];
    const map = new Map<string, Customer>();
    const now = Date.now();
    for (const b of list) {
      const key = customerKey(b);
      let c = map.get(key);
      if (!c) {
        c = {
          key,
          name: b.customer_name?.trim() || "Sem nome",
          phone: b.customer_phone,
          email: b.customer_email,
          total: 0,
          completed: 0,
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          lastVisit: null,
          nextVisit: null,
          totalSpentCents: 0,
          bookings: [],
        };
        map.set(key, c);
      }
      c.bookings.push(b);
      c.total += 1;
      c[b.status] = (c[b.status] as number) + 1;
      if (!c.phone && b.customer_phone) c.phone = b.customer_phone;
      if (!c.email && b.customer_email) c.email = b.customer_email;
      if (b.customer_name && c.name === "Sem nome") c.name = b.customer_name;
      const t = new Date(b.start_at).getTime();
      if (b.status === "completed" || (b.status === "confirmed" && t < now)) {
        if (!c.lastVisit || t > new Date(c.lastVisit).getTime()) c.lastVisit = b.start_at;
        if (b.status === "completed") c.totalSpentCents += b.service?.price_cents ?? 0;
      }
      if ((b.status === "confirmed" || b.status === "pending") && t >= now) {
        if (!c.nextVisit || t < new Date(c.nextVisit).getTime()) c.nextVisit = b.start_at;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aT = a.nextVisit ? new Date(a.nextVisit).getTime() : a.lastVisit ? -new Date(a.lastVisit).getTime() : 0;
      const bT = b.nextVisit ? new Date(b.nextVisit).getTime() : b.lastVisit ? -new Date(b.lastVisit).getTime() : 0;
      if (a.nextVisit && !b.nextVisit) return -1;
      if (!a.nextVisit && b.nextVisit) return 1;
      return aT - bT || b.total - a.total;
    });
  }, [bookingsQ.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.email].some((v) => (v || "").toLowerCase().includes(s))
    );
  }, [customers, search]);

  const detail = useMemo(() => customers.find((c) => c.key === detailKey) ?? null, [customers, detailKey]);

  const totalCustomers = customers.length;
  const recurring = customers.filter((c) => c.completed + c.confirmed >= 2).length;
  const upcoming = customers.filter((c) => c.nextVisit).length;

  if (companyQ.isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (!companyQ.data) {
    navigate({ to: "/onboarding", replace: true });
    return null;
  }

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
          <h1 className="font-display text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico completo, recorrência e próxima visita — agrupado por telefone.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat icon={Users} label="Clientes únicos" value={String(totalCustomers)} />
          <Stat icon={Repeat} label="Clientes recorrentes" value={String(recurring)} />
          <Stat icon={TrendingUp} label="Com próxima visita" value={String(upcoming)} />
        </div>

        <div className="surface-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Search className="size-3" /> Buscar cliente
            </Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, telefone ou e-mail" />
          </div>
        </div>

        {bookingsQ.isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <Users className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {customers.length === 0 ? "Ainda não há clientes cadastrados." : "Nenhum cliente encontrado."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <button
                key={c.key}
                onClick={() => setDetailKey(c.key)}
                className="surface-card p-5 w-full text-left hover:border-foreground/20 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" /> {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" /> {c.email}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        Total: <span className="text-foreground font-medium">{c.total}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Concluídos: <span className="text-foreground font-medium">{c.completed}</span>
                      </span>
                      {c.cancelled > 0 && (
                        <span className="text-muted-foreground">
                          Cancelados: <span className="text-foreground font-medium">{c.cancelled}</span>
                        </span>
                      )}
                      {c.totalSpentCents > 0 && (
                        <span className="text-muted-foreground">
                          Gasto: <span className="text-foreground font-medium">{formatBRL(c.totalSpentCents)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-1 text-xs">
                    {c.nextVisit ? (
                      <p className="inline-flex items-center gap-1 text-success">
                        <CalendarIcon className="size-3" /> Próxima: {formatDT(c.nextVisit, tz)}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Sem próxima visita</p>
                    )}
                    {c.lastVisit && (
                      <p className="text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="size-3" /> Última: {formatDT(c.lastVisit, tz)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <CustomerDetailsDialog customer={detail} tz={tz} onClose={() => setDetailKey(null)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
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

function CustomerDetailsDialog({ customer, tz, onClose }: { customer: Customer | null; tz: string; onClose: () => void }) {
  const open = !!customer;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer?.name}</DialogTitle>
          <DialogDescription>Histórico completo de agendamentos.</DialogDescription>
        </DialogHeader>
        {customer && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="size-3" /> {customer.phone}
                </a>
              )}
              {customer.phone && (
                <a
                  href={`https://wa.me/${normalizePhone(customer.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  WhatsApp
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="size-3" /> {customer.email}
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Total" value={String(customer.total)} />
              <MiniStat label="Concluídos" value={String(customer.completed)} />
              <MiniStat label="Cancelados" value={String(customer.cancelled)} />
              <MiniStat label="Gasto total" value={formatBRL(customer.totalSpentCents)} />
            </div>

            <div className="grid gap-2 text-xs">
              {customer.nextVisit && (
                <p className="text-success inline-flex items-center gap-1">
                  <CalendarIcon className="size-3" /> Próxima visita: {formatDT(customer.nextVisit, tz)}
                </p>
              )}
              {customer.lastVisit && (
                <p className="text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="size-3" /> Última visita: {formatDT(customer.lastVisit, tz)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Histórico</p>
              <div className="space-y-2">
                {customer.bookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{formatDT(b.start_at, tz)}</p>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.service?.name} · com {b.professional?.name} · {b.service?.duration_minutes} min · {formatBRL(b.service?.price_cents)}
                    </p>
                    {b.notes && (
                      <p className="text-xs text-muted-foreground inline-flex items-start gap-1">
                        <StickyNote className="size-3 mt-0.5" /> {b.notes}
                      </p>
                    )}
                    {b.status === "cancelled" && b.cancellation_reason && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">Motivo: {b.cancellation_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatDT(iso: string, tz: string) {
  return formatInTZ(iso, tz, { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatBRL(cents?: number | null) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}