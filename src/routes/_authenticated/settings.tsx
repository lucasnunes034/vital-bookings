import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar, Loader2, Plus, Trash2, Pencil, ArrowLeft, Users, Sparkles, Clock, Coffee, Copy, Check,
  Palette, Images, MessageCircle, RotateCcw, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploader } from "@/components/media-uploader";
import {
  DEFAULT_TEMPLATES,
  MESSAGE_KIND_HINT,
  MESSAGE_KIND_LABEL,
  MESSAGE_VARIABLES,
  type MessageKind,
} from "@/lib/whatsapp";
import { PROVIDER_CATALOG } from "@/lib/payments/providers";
import type { PaymentMode, PaymentProviderId } from "@/lib/payments/types";
import { computeChargeAmount } from "@/lib/payments/pricing";

type TabKey = "brand" | "gallery" | "services" | "professionals" | "availability" | "breaks" | "messages" | "payments";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => {
    const t = s.tab;
    return typeof t === "string" && ["brand", "gallery", "services", "professionals", "availability", "breaks", "messages", "payments"].includes(t)
      ? { tab: t as TabKey }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Configurações · Slotly" },
      { name: "description", content: "Gerencie serviços, profissionais, disponibilidade e pausas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab = (search.tab ?? "brand") as TabKey;

  const companyQ = useQuery({
    queryKey: ["my-company-first"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (companyQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!companyQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Você ainda não tem uma empresa cadastrada.</p>
          <Link to="/onboarding" className="btn-primary">Criar empresa</Link>
        </div>
      </div>
    );
  }

  const company = companyQ.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="btn-ghost h-9 !px-3 text-sm">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
            <Link to="/" className="hidden sm:flex items-center gap-2">
              <div className="relative size-7 rounded-lg overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Calendar className="size-4 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <span className="font-display text-lg font-semibold">Slotly</span>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground truncate max-w-[50%]">{company.name}</p>
        </div>
      </header>

      <main className="container-page py-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie serviços, profissionais, disponibilidade e pausas.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => navigate({ to: "/settings", search: { tab: v as TabKey }, replace: true })}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-3 sm:grid-cols-8 w-full sm:w-auto">
            <TabsTrigger value="brand"><Palette className="size-4 mr-1.5" /> Marca</TabsTrigger>
            <TabsTrigger value="gallery"><Images className="size-4 mr-1.5" /> Galeria</TabsTrigger>
            <TabsTrigger value="services"><Sparkles className="size-4 mr-1.5" /> Serviços</TabsTrigger>
            <TabsTrigger value="professionals"><Users className="size-4 mr-1.5" /> Equipe</TabsTrigger>
            <TabsTrigger value="availability"><Clock className="size-4 mr-1.5" /> Horários</TabsTrigger>
            <TabsTrigger value="breaks"><Coffee className="size-4 mr-1.5" /> Pausas</TabsTrigger>
            <TabsTrigger value="messages"><MessageCircle className="size-4 mr-1.5" /> Mensagens</TabsTrigger>
            <TabsTrigger value="payments"><Wallet className="size-4 mr-1.5" /> Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="brand"><BrandTab companyId={company.id} /></TabsContent>
          <TabsContent value="gallery"><GalleryTab companyId={company.id} /></TabsContent>
          <TabsContent value="services"><ServicesTab companyId={company.id} /></TabsContent>
          <TabsContent value="professionals"><ProfessionalsTab companyId={company.id} /></TabsContent>
          <TabsContent value="availability"><ScheduleTab companyId={company.id} kind="availability" /></TabsContent>
          <TabsContent value="breaks"><ScheduleTab companyId={company.id} kind="breaks" /></TabsContent>
          <TabsContent value="messages"><MessagesTab companyId={company.id} /></TabsContent>
          <TabsContent value="payments"><PaymentsTab companyId={company.id} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ------------------------------- Services ------------------------------- */

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80, "Máximo 80 caracteres"),
  duration_minutes: z.number().int().min(5, "Mínimo 5 min").max(1440, "Máximo 1440 min"),
  price_cents: z.number().int().min(0, "Preço inválido").max(100000000),
  status: z.enum(["active", "inactive"]),
});
type ServiceForm = z.infer<typeof serviceSchema> & { description?: string | null; photo_url?: string | null };
type ServiceRow = ServiceForm & { id: string };

function ServicesTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ServiceRow | null>(null);

  const q = useQuery({
    queryKey: ["settings-services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, status, description, photo_url")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido");
      qc.invalidateQueries({ queryKey: ["settings-services", companyId] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {q.data?.length ?? 0} serviço(s) cadastrados
        </p>
        <button className="btn-primary h-9 text-sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Novo serviço
        </button>
      </div>

      {q.isLoading ? (
        <Loader />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState label="Nenhum serviço ainda. Crie o primeiro." />
      ) : (
        <div className="grid gap-3">
          {q.data!.map((s) => (
            <div key={s.id} className="surface-card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{s.name}</p>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.duration_minutes} min · {formatBRL(s.price_cents)}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost h-9 !px-3 text-sm" onClick={() => setEditing(s)}>
                  <Pencil className="size-3.5" />
                </button>
                <button className="btn-ghost h-9 !px-3 text-sm text-red-400" onClick={() => setToDelete(s)}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceDialog
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        companyId={companyId}
        initial={editing}
      />

      <ConfirmDelete
        open={!!toDelete}
        title="Remover serviço?"
        description={`"${toDelete?.name}" será removido. Agendamentos existentes ligados a ele também serão apagados.`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        loading={del.isPending}
      />
    </div>
  );
}

function ServiceDialog({
  open, onClose, companyId, initial,
}: { open: boolean; onClose: () => void; companyId: string; initial: ServiceRow | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ServiceForm>({
    name: "", duration_minutes: 30, price_cents: 0, status: "active", description: "", photo_url: null,
  });
  const [priceStr, setPriceStr] = useState("0,00");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const base: ServiceForm = initial
        ? { name: initial.name, duration_minutes: initial.duration_minutes, price_cents: initial.price_cents, status: initial.status, description: initial.description ?? "", photo_url: initial.photo_url ?? null }
        : { name: "", duration_minutes: 30, price_cents: 0, status: "active", description: "", photo_url: null };
      setForm(base);
      setPriceStr((base.price_cents / 100).toFixed(2).replace(".", ","));
      setErrors({});
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = serviceSchema.safeParse(form);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { map[i.path.join(".")] = i.message; });
        setErrors(map);
        throw new Error("Verifique os campos");
      }
      const payload = { ...parsed.data, description: form.description || null, photo_url: form.photo_url || null };
      if (initial) {
        const { error } = await supabase.from("services").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Serviço atualizado" : "Serviço criado");
      qc.invalidateQueries({ queryKey: ["settings-services", companyId] });
      onClose();
    },
    onError: (e: any) => { if (e?.message && e.message !== "Verifique os campos") toast.error(e.message); },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>Nome, duração e preço aparecem no link público.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <MediaUploader companyId={companyId} kind="service" value={form.photo_url ?? null} onChange={(u) => setForm({ ...form, photo_url: u })} aspect="cover" label="Foto do serviço (opcional)" />
          <Field label="Nome" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Corte + barba" />
          </Field>
          <Field label="Descrição (opcional)">
            <Textarea rows={3} maxLength={500} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes sobre este serviço" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (min)" error={errors.duration_minutes}>
              <Input
                type="number" min={5} max={1440} step={5}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Preço (R$)" error={errors.price_cents}>
              <Input
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d,.]/g, "");
                  setPriceStr(raw);
                  const norm = raw.replace(/\./g, "").replace(",", ".");
                  const n = Number(norm);
                  setForm({ ...form, price_cents: Number.isFinite(n) ? Math.round(n * 100) : 0 });
                }}
                placeholder="0,00"
              />
            </Field>
          </div>
          <Field label="Status">
            <div className="flex items-center gap-3 h-10">
              <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
              <span className="text-sm text-muted-foreground">{form.status === "active" ? "Ativo (visível no link público)" : "Inativo (oculto)"}</span>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <button className="btn-ghost h-10 text-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-primary h-10 text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Professionals ---------------------------- */

const SKILL_LEVELS = ["iniciante", "intermediario", "avancado", "especialista"] as const;
const professionalSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  specialties: z.array(z.string().trim().min(1)).max(20),
  skill_level: z.enum(SKILL_LEVELS),
  status: z.enum(["active", "inactive"]),
});
type ProfessionalForm = z.infer<typeof professionalSchema> & { bio?: string | null; photo_url?: string | null };
type ProfessionalRow = ProfessionalForm & { id: string };

function ProfessionalsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProfessionalRow | null>(null);
  const [toDelete, setToDelete] = useState<ProfessionalRow | null>(null);

  const q = useQuery({
    queryKey: ["settings-professionals", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, specialties, skill_level, status, bio, photo_url")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfessionalRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional removido");
      qc.invalidateQueries({ queryKey: ["settings-professionals", companyId] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{q.data?.length ?? 0} profissional(is) cadastrados</p>
        <button className="btn-primary h-9 text-sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Novo profissional
        </button>
      </div>

      {q.isLoading ? (
        <Loader />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState label="Cadastre profissionais para receber agendamentos." />
      ) : (
        <div className="grid gap-3">
          {q.data!.map((p) => (
            <div key={p.id} className="surface-card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{p.name}</p>
                  <StatusBadge status={p.status} />
                  <span className="chip">{p.skill_level}</span>
                </div>
                {p.specialties.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{p.specialties.join(" · ")}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost h-9 !px-3 text-sm" onClick={() => setEditing(p)}>
                  <Pencil className="size-3.5" />
                </button>
                <button className="btn-ghost h-9 !px-3 text-sm text-red-400" onClick={() => setToDelete(p)}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfessionalDialog
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        companyId={companyId}
        initial={editing}
      />

      <ConfirmDelete
        open={!!toDelete}
        title="Remover profissional?"
        description={`"${toDelete?.name}" será removido junto com suas disponibilidades, pausas e agendamentos.`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        loading={del.isPending}
      />
    </div>
  );
}

function ProfessionalDialog({
  open, onClose, companyId, initial,
}: { open: boolean; onClose: () => void; companyId: string; initial: ProfessionalRow | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfessionalForm>({
    name: "", specialties: [], skill_level: "intermediario", status: "active", bio: "", photo_url: null,
  });
  const [specialtiesStr, setSpecialtiesStr] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const base: ProfessionalForm = initial
        ? { name: initial.name, specialties: initial.specialties, skill_level: initial.skill_level, status: initial.status, bio: initial.bio ?? "", photo_url: initial.photo_url ?? null }
        : { name: "", specialties: [], skill_level: "intermediario", status: "active", bio: "", photo_url: null };
      setForm(base);
      setSpecialtiesStr(base.specialties.join(", "));
      setErrors({});
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const specialties = specialtiesStr.split(",").map((s) => s.trim()).filter(Boolean);
      const parsed = professionalSchema.safeParse({ ...form, specialties });
      if (!parsed.success) {
        const map: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { map[i.path.join(".")] = i.message; });
        setErrors(map);
        throw new Error("Verifique os campos");
      }
      const payload = { ...parsed.data, bio: form.bio || null, photo_url: form.photo_url || null };
      if (initial) {
        const { error } = await supabase.from("professionals").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professionals").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Profissional atualizado" : "Profissional criado");
      qc.invalidateQueries({ queryKey: ["settings-professionals", companyId] });
      qc.invalidateQueries({ queryKey: ["settings-professionals-min", companyId] });
      onClose();
    },
    onError: (e: any) => { if (e?.message && e.message !== "Verifique os campos") toast.error(e.message); },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          <DialogDescription>Defina o nome, especialidades e nível.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-32 shrink-0">
              <MediaUploader companyId={companyId} kind="professional" value={form.photo_url ?? null} onChange={(u) => setForm({ ...form, photo_url: u })} aspect="square" label="Foto" />
            </div>
            <div className="flex-1 space-y-4">
          <Field label="Nome" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: João Silva" />
          </Field>
          <Field label="Especialidades (separadas por vírgula)">
            <Input value={specialtiesStr} onChange={(e) => setSpecialtiesStr(e.target.value)} placeholder="Corte masculino, Barba" />
          </Field>
            </div>
          </div>
          <Field label="Bio (opcional)">
            <Textarea rows={3} maxLength={500} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Formação, experiência, etc." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nível">
              <Select value={form.skill_level} onValueChange={(v: any) => setForm({ ...form, skill_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILL_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <div className="flex items-center gap-3 h-10">
                <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                <span className="text-sm text-muted-foreground">{form.status === "active" ? "Ativo" : "Inativo"}</span>
              </div>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <button className="btn-ghost h-10 text-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-primary h-10 text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------- Availability & Breaks (schedule) --------------------- */

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Slot = { id?: string; start_time: string; end_time: string; label?: string | null };
type SlotsByDay = Record<number, Slot[]>;

function emptyDays(): SlotsByDay {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function ScheduleTab({ companyId, kind }: { companyId: string; kind: "availability" | "breaks" }) {
  const qc = useQueryClient();
  const [profId, setProfId] = useState<string | null>(null);

  const profQ = useQuery({
    queryKey: ["settings-professionals-min", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!profId && profQ.data && profQ.data.length > 0) setProfId(profQ.data[0].id);
  }, [profId, profQ.data]);

  const table = kind === "availability" ? "professional_availability" : "professional_breaks";
  const queryKey = ["settings-schedule", table, profId];

  const slotsQ = useQuery({
    queryKey,
    enabled: !!profId,
    queryFn: async () => {
      const cols = kind === "availability"
        ? "id, day_of_week, start_time, end_time"
        : "id, day_of_week, start_time, end_time, label";
      const { data, error } = await supabase.from(table).select(cols).eq("professional_id", profId!);
      if (error) throw error;
      const grouped = emptyDays();
      (data as any[] ?? []).forEach((r) => {
        grouped[r.day_of_week].push({
          id: r.id,
          start_time: (r.start_time as string).slice(0, 5),
          end_time: (r.end_time as string).slice(0, 5),
          label: kind === "breaks" ? (r.label ?? "") : null,
        });
      });
      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
      return grouped;
    },
  });

  const [draft, setDraft] = useState<SlotsByDay>(emptyDays());
  useEffect(() => { if (slotsQ.data) setDraft(slotsQ.data); }, [slotsQ.data]);

  const hasChanges = useMemo(() => {
    if (!slotsQ.data) return false;
    return JSON.stringify(slotsQ.data) !== JSON.stringify(draft);
  }, [slotsQ.data, draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profId) throw new Error("Selecione um profissional");
      for (const dow of Object.keys(draft).map(Number)) {
        const slots = draft[dow];
        for (const s of slots) {
          if (!/^\d{2}:\d{2}$/.test(s.start_time) || !/^\d{2}:\d{2}$/.test(s.end_time)) {
            throw new Error(`Horário inválido em ${DAYS[dow]}`);
          }
          if (s.end_time <= s.start_time) {
            throw new Error(`Fim precisa ser depois do início em ${DAYS[dow]}`);
          }
        }
        const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].start_time < sorted[i - 1].end_time) {
            throw new Error(`Intervalos sobrepostos em ${DAYS[dow]}`);
          }
        }
      }
      const { error: delErr } = await supabase.from(table).delete().eq("professional_id", profId);
      if (delErr) throw delErr;
      const rows: any[] = [];
      Object.entries(draft).forEach(([dow, slots]) => {
        slots.forEach((s) => {
          const base: any = {
            professional_id: profId,
            company_id: companyId,
            day_of_week: Number(dow),
            start_time: s.start_time + ":00",
            end_time: s.end_time + ":00",
          };
          if (kind === "breaks") base.label = s.label?.trim() || null;
          rows.push(base);
        });
      });
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from(table).insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Alterações salvas");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  const addSlot = (dow: number) => {
    setDraft((d) => ({
      ...d,
      [dow]: [...d[dow], { start_time: "09:00", end_time: "12:00", label: kind === "breaks" ? "" : null }],
    }));
  };
  const removeSlot = (dow: number, idx: number) => {
    setDraft((d) => ({ ...d, [dow]: d[dow].filter((_, i) => i !== idx) }));
  };
  const updateSlot = (dow: number, idx: number, patch: Partial<Slot>) => {
    setDraft((d) => ({ ...d, [dow]: d[dow].map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  };

  const copyMondayToWeek = () => {
    setDraft((d) => {
      const mon = d[1];
      const next: SlotsByDay = { ...d };
      for (let i = 1; i <= 5; i++) next[i] = mon.map((s) => ({ ...s }));
      return next;
    });
    toast.message("Segunda copiada para dias úteis. Salve para confirmar.");
  };

  if (profQ.isLoading) return <Loader />;
  if ((profQ.data?.length ?? 0) === 0) {
    return <EmptyState label="Cadastre um profissional antes de configurar horários." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Profissional</Label>
          <Select value={profId ?? undefined} onValueChange={setProfId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Escolha" /></SelectTrigger>
            <SelectContent>
              {profQ.data!.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost h-9 text-sm" onClick={copyMondayToWeek} title="Copiar segunda para dias úteis">
            <Copy className="size-3.5" /> Copiar seg → seg–sex
          </button>
          <button className="btn-primary h-9 text-sm" onClick={() => save.mutate()} disabled={!hasChanges || save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar alterações
          </button>
        </div>
      </div>

      {slotsQ.isLoading ? <Loader /> : (
        <div className="grid gap-3">
          {DAYS.map((label, dow) => (
            <div key={dow} className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-sm">{label}</p>
                <button className="btn-ghost h-8 !px-3 text-xs" onClick={() => addSlot(dow)}>
                  <Plus className="size-3.5" /> Adicionar
                </button>
              </div>
              {draft[dow].length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {kind === "availability" ? "Fechado neste dia." : "Sem pausas."}
                </p>
              ) : (
                <div className="space-y-2">
                  {draft[dow].map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="time"
                        className="w-[120px]"
                        value={s.start_time}
                        onChange={(e) => updateSlot(dow, idx, { start_time: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        className="w-[120px]"
                        value={s.end_time}
                        onChange={(e) => updateSlot(dow, idx, { end_time: e.target.value })}
                      />
                      {kind === "breaks" && (
                        <Input
                          className="flex-1 min-w-[160px]"
                          placeholder="Rótulo (opcional): almoço, café..."
                          value={s.label ?? ""}
                          onChange={(e) => updateSlot(dow, idx, { label: e.target.value })}
                        />
                      )}
                      <button className="btn-ghost h-9 !px-3 text-sm text-red-400" onClick={() => removeSlot(dow, idx)}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Helpers --------------------------------- */

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`chip ${status === "active" ? "!text-emerald-300 !border-emerald-500/30" : ""}`}>
      {status === "active" ? "Ativo" : "Inativo"}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="surface-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function ConfirmDelete({
  open, title, description, onCancel, onConfirm, loading,
}: { open: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void; loading?: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ================================================================
   Brand + Gallery tabs
   ================================================================ */

const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
type BusinessHours = Record<string, { open: string; close: string }[]>;
type BrandRow = {
  logo_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  whatsapp_phone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  business_hours: BusinessHours | null;
};

function BrandTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings-brand", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("logo_url, cover_url, tagline, description, address, city, state, postal_code, whatsapp_phone, instagram_url, facebook_url, website_url, business_hours")
        .eq("id", companyId).single();
      if (error) throw error;
      return data as unknown as BrandRow;
    },
  });

  const [form, setForm] = useState<BrandRow | null>(null);
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase.from("companies").update({
        logo_url: form.logo_url,
        cover_url: form.cover_url,
        tagline: form.tagline?.slice(0, 160) || null,
        description: form.description?.slice(0, 4000) || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        whatsapp_phone: form.whatsapp_phone || null,
        instagram_url: form.instagram_url || null,
        facebook_url: form.facebook_url || null,
        website_url: form.website_url || null,
        business_hours: form.business_hours ?? {},
      }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marca atualizada");
      qc.invalidateQueries({ queryKey: ["settings-brand", companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  if (q.isLoading || !form) return <Loader />;

  const set = (patch: Partial<BrandRow>) => setForm({ ...form, ...patch });
  const hours = form.business_hours || {};
  const setDayHours = (day: string, slots: { open: string; close: string }[]) =>
    set({ business_hours: { ...hours, [day]: slots } });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-[220px_1fr]">
        <MediaUploader companyId={companyId} kind="logo" value={form.logo_url} onChange={(u) => set({ logo_url: u })} aspect="square" label="Logo" hint="Formato quadrado, PNG/JPG até 8 MB." />
        <MediaUploader companyId={companyId} kind="cover" value={form.cover_url} onChange={(u) => set({ cover_url: u })} aspect="cover" label="Capa" hint="Aparece no topo da página pública (16:6)." />
      </section>

      <section className="surface-card p-5 space-y-4">
        <h3 className="font-medium">Identidade</h3>
        <Field label="Slogan (aparece abaixo do nome)">
          <Input value={form.tagline ?? ""} maxLength={160} onChange={(e) => set({ tagline: e.target.value })} placeholder="Ex.: Onde seu estilo acontece." />
        </Field>
        <Field label="Descrição">
          <Textarea value={form.description ?? ""} rows={5} maxLength={4000} onChange={(e) => set({ description: e.target.value })} placeholder="Conte sua história, diferenciais, especialidades..." />
        </Field>
      </section>

      <section className="surface-card p-5 space-y-4">
        <h3 className="font-medium">Contato & Redes</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="WhatsApp (com DDD e país)"><Input value={form.whatsapp_phone ?? ""} onChange={(e) => set({ whatsapp_phone: e.target.value })} placeholder="+55 11 90000-0000" /></Field>
          <Field label="Site"><Input value={form.website_url ?? ""} onChange={(e) => set({ website_url: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Instagram (URL)"><Input value={form.instagram_url ?? ""} onChange={(e) => set({ instagram_url: e.target.value })} placeholder="https://instagram.com/..." /></Field>
          <Field label="Facebook (URL)"><Input value={form.facebook_url ?? ""} onChange={(e) => set({ facebook_url: e.target.value })} placeholder="https://facebook.com/..." /></Field>
        </div>
      </section>

      <section className="surface-card p-5 space-y-4">
        <h3 className="font-medium">Endereço</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Rua e número"><Input value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} placeholder="Av. Paulista, 1000" /></Field>
          <Field label="CEP"><Input value={form.postal_code ?? ""} onChange={(e) => set({ postal_code: e.target.value })} placeholder="01310-100" /></Field>
          <Field label="Cidade"><Input value={form.city ?? ""} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="Estado"><Input value={form.state ?? ""} onChange={(e) => set({ state: e.target.value })} placeholder="SP" /></Field>
        </div>
        <p className="text-xs text-muted-foreground">O mapa é gerado automaticamente pelo endereço na página pública.</p>
      </section>

      <section className="surface-card p-5 space-y-4">
        <h3 className="font-medium">Horário de funcionamento</h3>
        <p className="text-xs text-muted-foreground">Estes horários são apenas informativos — os slots continuam vindo da disponibilidade de cada profissional.</p>
        <div className="space-y-2">
          {DAY_KEYS.map((d, i) => (
            <BusinessHoursRow key={d} label={DAYS[i]} slots={hours[d] || []} onChange={(slots) => setDayHours(d, slots)} />
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button className="btn-primary h-10 text-sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar alterações
        </button>
      </div>
    </div>
  );
}

function BusinessHoursRow({
  label, slots, onChange,
}: { label: string; slots: { open: string; close: string }[]; onChange: (s: { open: string; close: string }[]) => void }) {
  return (
    <div className="flex items-center gap-3 flex-wrap border border-border rounded-lg p-2.5">
      <span className="w-20 text-sm text-muted-foreground">{label}</span>
      {slots.length === 0 && <span className="text-xs text-muted-foreground">Fechado</span>}
      {slots.map((s, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input type="time" className="w-[110px] h-9" value={s.open} onChange={(e) => onChange(slots.map((x, i) => i === idx ? { ...x, open: e.target.value } : x))} />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="time" className="w-[110px] h-9" value={s.close} onChange={(e) => onChange(slots.map((x, i) => i === idx ? { ...x, close: e.target.value } : x))} />
          <button className="btn-ghost h-9 !px-2 text-red-400" onClick={() => onChange(slots.filter((_, i) => i !== idx))}><Trash2 className="size-3.5" /></button>
        </div>
      ))}
      <button className="btn-ghost h-8 !px-3 text-xs ml-auto" onClick={() => onChange([...slots, { open: "09:00", close: "18:00" }])}>
        <Plus className="size-3.5" /> Adicionar
      </button>
    </div>
  );
}

/* ---------------- Gallery ---------------- */

type GalleryItem = { url: string; caption?: string | null };

function GalleryTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings-gallery", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("gallery").eq("id", companyId).single();
      if (error) throw error;
      return ((data?.gallery ?? []) as unknown as GalleryItem[]) || [];
    },
  });

  const save = useMutation({
    mutationFn: async (next: GalleryItem[]) => {
      const { error } = await supabase.from("companies").update({ gallery: next as any }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings-gallery", companyId] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  if (q.isLoading) return <Loader />;
  const items = q.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} imagem(ns) na galeria (máx. 24)</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((it, i) => (
          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
            <img src={it.url} alt={it.caption ?? ""} className="w-full h-full object-cover" />
            <button
              onClick={() => save.mutate(items.filter((_, x) => x !== i))}
              className="absolute top-2 right-2 h-8 px-2 rounded-md bg-background/90 border border-border text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {items.length < 24 && (
          <div className="aspect-square">
            <MediaUploader
              companyId={companyId}
              kind="gallery"
              value={null}
              onChange={(url) => { if (url) save.mutate([...items, { url }]); }}
              aspect="square"
              label=""
              hint=""
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Mensagens (WhatsApp) ============

const MSG_ORDER: MessageKind[] = ["confirmation", "reschedule", "cancellation", "reminder_24h", "reminder_1h"];

function MessagesTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const templatesQ = useQuery({
    queryKey: ["message-templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, kind, body, enabled")
        .eq("company_id", companyId);
      if (error) throw error;
      return data as Array<{ id: string; kind: MessageKind; body: string; enabled: boolean }>;
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: { kind: MessageKind; body: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("message_templates")
        .upsert({ company_id: companyId, ...payload }, { onConflict: "company_id,kind" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem salva");
      qc.invalidateQueries({ queryKey: ["message-templates", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  if (templatesQ.isLoading) {
    return <div className="py-8 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  const byKind = new Map(templatesQ.data?.map((t) => [t.kind, t]) ?? []);

  return (
    <div className="space-y-4">
      <div className="surface-card p-4 space-y-1.5">
        <p className="text-sm font-medium">Mensagens automáticas por WhatsApp</p>
        <p className="text-xs text-muted-foreground">
          Personalize os textos que você envia para os clientes. Use as variáveis abaixo entre chaves — elas são substituídas automaticamente pelos dados do agendamento.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {MESSAGE_VARIABLES.map((v) => (
            <span key={v.key} className="text-[11px] px-2 py-0.5 rounded-md border border-border/60 bg-muted/50 font-mono">
              {"{" + v.key + "} "}
              <span className="font-sans text-muted-foreground">— {v.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {MSG_ORDER.map((k) => (
          <TemplateEditor
            key={k}
            kind={k}
            initial={byKind.get(k) ?? { body: DEFAULT_TEMPLATES[k], enabled: true }}
            onSave={(body, enabled) => upsert.mutate({ kind: k, body, enabled })}
            saving={upsert.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  kind,
  initial,
  onSave,
  saving,
}: {
  kind: MessageKind;
  initial: { body: string; enabled: boolean };
  onSave: (body: string, enabled: boolean) => void;
  saving: boolean;
}) {
  const [body, setBody] = useState(initial.body);
  const [enabled, setEnabled] = useState(initial.enabled);
  const dirty = body !== initial.body || enabled !== initial.enabled;

  useEffect(() => { setBody(initial.body); setEnabled(initial.enabled); }, [initial.body, initial.enabled]);

  return (
    <div className="surface-card p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{MESSAGE_KIND_LABEL[kind]}</p>
          <p className="text-xs text-muted-foreground">{MESSAGE_KIND_HINT[kind]}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={enabled} onCheckedChange={setEnabled} /> Ativo
        </label>
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="font-mono text-sm" />
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setBody(DEFAULT_TEMPLATES[kind]); }}
          className="btn-ghost h-9 !px-3 text-xs"
          title="Restaurar texto padrão"
        >
          <RotateCcw className="size-3.5" /> Restaurar padrão
        </button>
        <button
          onClick={() => onSave(body, enabled)}
          disabled={!dirty || saving}
          className="btn-primary h-9 !px-3 text-xs"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Salvar
        </button>
      </div>
    </div>
  );
}
