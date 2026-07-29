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
  MapPin,
  ExternalLink,
  MessageCircle,
  Wrench,
  User as UserIcon,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizePhone as normalizeWa } from "@/lib/whatsapp";

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

      <CustomerDetailsPanel customer={detail} tz={tz} onClose={() => setDetailKey(null)} />
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

function CustomerDetailsPanel({ customer, tz, onClose }: { customer: Customer | null; tz: string; onClose: () => void }) {
  const isMobile = useIsMobile();
  const open = !!customer;
  const mock = customer ? mockProfileFor(customer.key) : null;
  const history = customer ? enrichHistory(customer) : [];
  const waPhone = customer?.phone ? normalizeWa(customer.phone) : "";
  const mapsUrl = mock ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mock.address)}` : "";

  const title = (
    <span className="flex items-center gap-2">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserIcon className="size-4" />
      </span>
      {customer?.name}
    </span>
  );

  const body = customer && (
    <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Total" value={String(customer.total)} />
              <MiniStat label="Concluídos" value={String(customer.completed)} />
              <MiniStat label="Cancelados" value={String(customer.cancelled)} />
              <MiniStat label="Gasto total" value={formatBRL(customer.totalSpentCents || mockRevenueCents(history))} />
            </div>

            <Tabs defaultValue="contato" className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="contato">Contato</TabsTrigger>
                <TabsTrigger value="historico">Histórico de Serviços</TabsTrigger>
              </TabsList>

              <TabsContent value="contato" className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow icon={UserIcon} label="Nome">
                    <span className="text-foreground">{customer.name}</span>
                  </InfoRow>
                  <InfoRow icon={Phone} label="Telefone">
                    {customer.phone ? (
                      <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </InfoRow>
                  <InfoRow icon={MessageCircle} label="WhatsApp">
                    {waPhone ? (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-md text-white shadow-sm transition hover:opacity-90 h-12 sm:h-9 px-4 text-sm font-medium"
                        style={{ backgroundColor: "#25D366" }}
                      >
                        <MessageCircle className="size-4" /> Abrir WhatsApp <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </InfoRow>
                  <InfoRow icon={Mail} label="E-mail">
                    {customer.email ? (
                      <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </InfoRow>
                </div>

                {mock && (
                  <div className="rounded-lg border border-border/60 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                          <MapPin className="size-3" /> Endereço
                        </p>
                        <p className="font-medium">{mock.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {mock.neighborhood} · {mock.city} — {mock.state}, {mock.zip}
                        </p>
                      </div>
                      <Button asChild variant="outline" className="shrink-0 h-10 sm:h-9">
                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" /> Mapa
                        </a>
                      </Button>
                    </div>
                    <div className="aspect-[16/8] w-full overflow-hidden rounded-md border border-border/60">
                      <iframe
                        title="Mapa do endereço"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(mock.address + ", " + mock.city)}&output=embed`}
                        className="w-full h-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                )}

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
              </TabsContent>

              <TabsContent value="historico" className="mt-4">
                <div className="hidden md:block rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Data</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[110px] text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                            Sem atendimentos registrados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        history.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="text-xs whitespace-nowrap">{formatDT(h.date, tz)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Wrench className="size-3.5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{h.service}</p>
                                  {h.notes && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">{h.notes}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{h.professional}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_STYLE[h.status]}>
                                {STATUS_LABEL[h.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">
                              {formatBRL(h.priceCents)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2">
                  {history.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6 rounded-lg border border-border/60">
                      Sem atendimentos registrados.
                    </p>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-start gap-2">
                            <Wrench className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{h.service}</p>
                              <p className="text-[11px] text-muted-foreground">{formatDT(h.date, tz)} · {h.professional}</p>
                              {h.notes && <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{h.notes}</p>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">{formatBRL(h.priceCents)}</p>
                            <Badge variant="outline" className={`mt-1 ${STATUS_STYLE[h.status]}`}>
                              {STATUS_LABEL[h.status]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {history.length > 0 && (
                  <div className="mt-3 flex justify-end text-xs text-muted-foreground">
                    Total no histórico: <span className="ml-1 text-foreground font-semibold">{formatBRL(history.reduce((s, h) => s + h.priceCents, 0))}</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>Detalhes do cliente, contato e histórico de atendimentos.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Detalhes do cliente, contato e histórico de atendimentos.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Users; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

// --- Mock enrichment (dados de exemplo p/ contexto HVAC/residencial) ---

const MOCK_ADDRESSES = [
  { address: "Rua das Palmeiras, 145 — Apto 42", neighborhood: "Vila Madalena", city: "São Paulo", state: "SP", zip: "05435-020" },
  { address: "Av. Beira-Mar, 2.100 — Casa 3", neighborhood: "Meireles", city: "Fortaleza", state: "CE", zip: "60165-121" },
  { address: "Rua Coronel Andrade, 87", neighborhood: "Batel", city: "Curitiba", state: "PR", zip: "80420-160" },
  { address: "Alameda Santos, 950 — Cj. 1204", neighborhood: "Jardim Paulista", city: "São Paulo", state: "SP", zip: "01418-100" },
  { address: "Rua Voluntários da Pátria, 322", neighborhood: "Botafogo", city: "Rio de Janeiro", state: "RJ", zip: "22270-000" },
  { address: "Av. do Contorno, 4.500", neighborhood: "Funcionários", city: "Belo Horizonte", state: "MG", zip: "30110-090" },
];

const MOCK_HVAC_SERVICES = [
  { name: "Higienização de Split 12.000 BTUs", price: 22000 },
  { name: "Instalação de Ar-Condicionado Split", price: 65000 },
  { name: "Manutenção Preventiva — 2 aparelhos", price: 38000 },
  { name: "Recarga de Gás R-410A", price: 45000 },
  { name: "Troca de Placa Eletrônica", price: 58000 },
  { name: "Limpeza de Filtros e Serpentina", price: 18000 },
  { name: "Vistoria Técnica Residencial", price: 15000 },
];

const MOCK_TECHS = ["Carlos Andrade", "Ricardo Menezes", "Bruno Tavares", "Lucas Oliveira"];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockProfileFor(key: string) {
  const h = hashKey(key);
  return MOCK_ADDRESSES[h % MOCK_ADDRESSES.length];
}

type HistoryEntry = {
  id: string;
  date: string;
  service: string;
  professional: string;
  status: Status;
  priceCents: number;
  notes: string | null;
};

function enrichHistory(customer: Customer): HistoryEntry[] {
  if (customer.bookings.length > 0) {
    const h = hashKey(customer.key);
    return customer.bookings.map((b, i) => {
      const fallback = MOCK_HVAC_SERVICES[(h + i) % MOCK_HVAC_SERVICES.length];
      return {
        id: b.id,
        date: b.start_at,
        service: b.service?.name || fallback.name,
        professional: b.professional?.name || MOCK_TECHS[(h + i) % MOCK_TECHS.length],
        status: b.status,
        priceCents: b.service?.price_cents ?? fallback.price,
        notes: b.notes,
      };
    });
  }
  // No real bookings — return mock AC service history
  const h = hashKey(customer.key);
  const now = Date.now();
  return Array.from({ length: 4 }).map((_, i) => {
    const svc = MOCK_HVAC_SERVICES[(h + i) % MOCK_HVAC_SERVICES.length];
    return {
      id: `mock-${customer.key}-${i}`,
      date: new Date(now - (i + 1) * 1000 * 60 * 60 * 24 * 45).toISOString(),
      service: svc.name,
      professional: MOCK_TECHS[(h + i) % MOCK_TECHS.length],
      status: (i === 0 ? "confirmed" : "completed") as Status,
      priceCents: svc.price,
      notes: i % 2 === 0 ? "Cliente relatou baixo rendimento do aparelho da sala." : null,
    };
  });
}

function mockRevenueCents(history: HistoryEntry[]): number {
  return history.filter((h) => h.status === "completed").reduce((s, h) => s + h.priceCents, 0);
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