import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, Plus, Trash2, Check, ArrowRight, X, Sparkles, Clock, Coffee, Copy } from "lucide-react";

import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configurar empresa · Slotly" },
      { name: "description", content: "Configure sua empresa e serviços no Slotly em minutos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const SEGMENTS = [
  "Barbearia",
  "Salão de beleza",
  "Clínica / Consultório",
  "Estética",
  "Estúdio de tatuagem",
  "Pet shop",
  "Mecânica / Auto",
  "Personal / Estúdio",
  "Outro",
];

const companySchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  slug: z
    .string()
    .trim()
    .min(3, "Slug muito curto")
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  segment: z.string().min(1, "Escolha um segmento"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      if (data && data.length > 0) {
        setCompanyId(data[0].id);
        setStep(2);
      }
      setChecking(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative size-7 rounded-lg overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="size-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-display text-lg font-semibold">Slotly</span>
        </Link>
        <Stepper step={step} />
      </header>

      <div className="relative flex-1 flex items-center justify-center px-4 py-10">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="relative w-full max-w-lg">
          {checking ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : step === 1 ? (
            <CompanyStep
              onDone={(id) => {
                setCompanyId(id);
                setStep(2);
              }}
            />
          ) : step === 2 ? (
            <ServicesStep companyId={companyId!} onNext={() => setStep(3)} />
          ) : step === 3 ? (
            <ProfessionalsStep companyId={companyId!} onNext={() => setStep(4)} />
          ) : (
            <AvailabilityStep companyId={companyId!} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
      <StepDot n={1} label="Empresa" active={step === 1} done={step > 1} />
      <span className="h-px w-4 bg-border" />
      <StepDot n={2} label="Serviços" active={step === 2} done={step > 2} />
      <span className="h-px w-4 bg-border" />
      <StepDot n={3} label="Profissionais" active={step === 3} done={step > 3} />
      <span className="h-px w-4 bg-border" />
      <StepDot n={4} label="Disponibilidade" active={step === 4} done={false} />
    </div>
  );
}


function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          "flex size-6 items-center justify-center rounded-full text-[11px] font-medium " +
          (done
            ? "bg-primary text-primary-foreground"
            : active
              ? "border border-primary text-foreground"
              : "border border-border")
        }
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <span className={active || done ? "text-foreground" : ""}>{label}</span>
    </div>
  );
}

function CompanyStep({ onDone }: { onDone: (companyId: string) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [segment, setSegment] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const preview = useMemo(() => slug || "sua-empresa", [slug]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = companySchema.safeParse({ name, slug, segment, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        segment: parsed.data.segment,
        phone: parsed.data.phone || null,
        owner_id: userData.user.id,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      if (error.code === "23505") toast.error("Esse link já está em uso. Escolha outro.");
      else toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-companies"] });
    toast.success("Empresa criada! 🎉");
    onDone(data.id);
  };

  return (
    <form onSubmit={onSubmit} className="surface-card p-8 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Passo 1 de 4</p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          Vamos configurar sua empresa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Isso leva menos de 30 segundos. Você pode ajustar tudo depois.
        </p>
      </div>

      <FormField label="Nome da empresa">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Barbearia do João" required />
      </FormField>

      <FormField label="Segmento">
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha um segmento" />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Link público">
        <div className="flex items-center rounded-lg border border-input bg-transparent focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3 pr-1 text-sm text-muted-foreground">slotly.app/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="minha-empresa"
            className="flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Seus clientes agendarão em <span className="text-foreground">slotly.app/{preview}</span>
        </p>
      </FormField>

      <FormField label="Telefone / WhatsApp (opcional)">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
      </FormField>

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : (
          <>Continuar <ArrowRight className="size-4" /></>
        )}
      </button>
    </form>
  );
}

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  duration_minutes: z.coerce.number().int().min(5, "Mínimo 5 min").max(1440, "Máximo 24h"),
  price: z.coerce.number().min(0, "Preço inválido").max(999999, "Preço muito alto"),
  status: z.enum(["active", "inactive"]),
});

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  status: "active" | "inactive";
};

function ServicesStep({ companyId, onNext }: { companyId: string; onNext: () => void }) {
  const queryClient = useQueryClient();

  const { data: services, refetch, isLoading } = useQuery({
    queryKey: ["services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, status")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = serviceSchema.safeParse({
      name,
      duration_minutes: duration,
      price: price === "" ? 0 : price,
      status,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSaving(true);
    const { error } = await supabase.from("services").insert({
      company_id: companyId,
      name: parsed.data.name,
      duration_minutes: parsed.data.duration_minutes,
      price_cents: Math.round(parsed.data.price * 100),
      status: parsed.data.status,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    setPrice("");
    setDuration("30");
    setStatus("active");
    await refetch();
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refetch();
  };

  const onToggle = async (row: ServiceRow) => {
    const next = row.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("services").update({ status: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    await refetch();
  };

  const onFinish = async () => {
    setFinishing(true);
    await queryClient.invalidateQueries();
    onNext();
    setFinishing(false);
  };

  return (
    <div className="space-y-6">
      <div className="surface-card p-8 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Passo 2 de 4</p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Cadastre seus serviços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione o que você oferece. Você pode editar, pausar ou remover a qualquer momento.
          </p>
        </div>

        <form onSubmit={onAdd} className="space-y-4">
          <FormField label="Nome do serviço">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte + barba" required />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Duração (min)">
              <Input
                type="number"
                inputMode="numeric"
                min={5}
                max={1440}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Preço (R$)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Serviço ativo</p>
              <p className="text-xs text-muted-foreground">Aparece para clientes agendarem.</p>
            </div>
            <Switch
              checked={status === "active"}
              onCheckedChange={(v) => setStatus(v ? "active" : "inactive")}
            />
          </div>

          <button type="submit" disabled={saving} className="btn-ghost w-full disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : (
              <><Plus className="size-4" /> Adicionar serviço</>
            )}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Cadastrados {services ? `(${services.length})` : ""}
          </p>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : services && services.length > 0 ? (
            <ul className="space-y-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.duration_minutes} min · {formatBRL(s.price_cents)}
                    </p>
                  </div>
                  <span
                    className={
                      "text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 " +
                      (s.status === "active"
                        ? "border-primary/40 text-foreground"
                        : "border-border text-muted-foreground")
                    }
                  >
                    {s.status === "active" ? "Ativo" : "Pausado"}
                  </span>
                  <Switch
                    checked={s.status === "active"}
                    onCheckedChange={() => onToggle(s)}
                  />
                  <button
                    type="button"
                    onClick={() => onDelete(s.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum serviço ainda. Adicione o primeiro acima.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onFinish}
          className="btn-ghost"
          disabled={finishing}
        >
          Pular por agora
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing || !services || services.length === 0}
          className="btn-primary disabled:opacity-60"
        >
          {finishing ? <Loader2 className="size-4 animate-spin" /> : (
            <>Continuar <ArrowRight className="size-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const SKILL_LEVELS: { value: "iniciante" | "intermediario" | "avancado" | "especialista"; label: string }[] = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
  { value: "especialista", label: "Especialista" },
];

const professionalSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  skill_level: z.enum(["iniciante", "intermediario", "avancado", "especialista"]),
  status: z.enum(["active", "inactive"]),
  specialties: z.array(z.string().trim().min(1).max(40)).max(20, "Muitas especialidades"),
});

type ProfessionalRow = {
  id: string;
  name: string;
  specialties: string[];
  skill_level: "iniciante" | "intermediario" | "avancado" | "especialista";
  status: "active" | "inactive";
};

function ProfessionalsStep({ companyId, onNext }: { companyId: string; onNext: () => void }) {
  const queryClient = useQueryClient();


  const { data: pros, refetch, isLoading } = useQuery({
    queryKey: ["professionals", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, specialties, skill_level, status")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ProfessionalRow[];
    },
  });

  const [name, setName] = useState("");
  const [skill, setSkill] = useState<ProfessionalRow["skill_level"]>("intermediario");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const addSpecialty = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (v.length > 40) return toast.error("Especialidade muito longa");
    if (specialties.includes(v)) return;
    if (specialties.length >= 20) return toast.error("Limite de 20 especialidades");
    setSpecialties([...specialties, v]);
    setSpecInput("");
  };

  const onSpecKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSpecialty(specInput);
    } else if (e.key === "Backspace" && specInput === "" && specialties.length > 0) {
      setSpecialties(specialties.slice(0, -1));
    }
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = professionalSchema.safeParse({
      name,
      skill_level: skill,
      status,
      specialties,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSaving(true);
    const { error } = await supabase.from("professionals").insert({
      company_id: companyId,
      name: parsed.data.name,
      skill_level: parsed.data.skill_level,
      status: parsed.data.status,
      specialties: parsed.data.specialties,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    setSpecialties([]);
    setSpecInput("");
    setSkill("intermediario");
    setStatus("active");
    await refetch();
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("professionals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refetch();
  };

  const onToggle = async (row: ProfessionalRow) => {
    const next = row.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("professionals").update({ status: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    await refetch();
  };

  const onFinish = async () => {
    setFinishing(true);
    await queryClient.invalidateQueries();
    onNext();
    setFinishing(false);
  };

  return (
    <div className="space-y-6">
      <div className="surface-card p-8 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Passo 3 de 4</p>

          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Cadastre seus profissionais
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione quem atende no seu negócio. Você pode pausar ou remover a qualquer momento.
          </p>
        </div>

        <form onSubmit={onAdd} className="space-y-4">
          <FormField label="Nome do profissional">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" required />
          </FormField>

          <FormField label="Especialidades">
            <div className="rounded-lg border border-input bg-transparent px-2 py-2 focus-within:ring-2 focus-within:ring-ring">
              <div className="flex flex-wrap gap-1.5">
                {specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-2.5 py-0.5 text-xs"
                  >
                    <Sparkles className="size-3 text-muted-foreground" /> {s}
                    <button
                      type="button"
                      onClick={() => setSpecialties(specialties.filter((x) => x !== s))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remover ${s}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={onSpecKey}
                  onBlur={() => specInput && addSpecialty(specInput)}
                  placeholder={specialties.length === 0 ? "Corte, coloração, barba..." : ""}
                  className="flex-1 min-w-[120px] bg-transparent px-1 py-1 text-sm outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pressione Enter ou vírgula para adicionar.
            </p>
          </FormField>

          <FormField label="Nível de habilidade">
            <Select value={skill} onValueChange={(v) => setSkill(v as ProfessionalRow["skill_level"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Profissional ativo</p>
              <p className="text-xs text-muted-foreground">Aparece para clientes agendarem.</p>
            </div>
            <Switch
              checked={status === "active"}
              onCheckedChange={(v) => setStatus(v ? "active" : "inactive")}
            />
          </div>

          <button type="submit" disabled={saving} className="btn-ghost w-full disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : (
              <><Plus className="size-4" /> Adicionar profissional</>
            )}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Cadastrados {pros ? `(${pros.length})` : ""}
          </p>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : pros && pros.length > 0 ? (
            <ul className="space-y-2">
              {pros.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/50 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        {SKILL_LEVELS.find((l) => l.value === p.skill_level)?.label ?? p.skill_level}
                      </span>
                    </div>
                    {p.specialties.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {p.specialties.join(" · ")}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={p.status === "active"}
                    onCheckedChange={() => onToggle(p)}
                  />
                  <button
                    type="button"
                    onClick={() => onDelete(p.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum profissional ainda. Adicione o primeiro acima.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button type="button" onClick={onFinish} className="btn-ghost" disabled={finishing}>
          Pular por agora
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing || !pros || pros.length === 0}
          className="btn-primary disabled:opacity-60"
        >
          {finishing ? <Loader2 className="size-4 animate-spin" /> : (
            <>Continuar <ArrowRight className="size-4" /></>
          )}

        </button>
      </div>
    </div>
  );
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const WEEKDAYS: { value: 0 | 1 | 2 | 3 | 4 | 5 | 6; short: string; full: string }[] = [
  { value: 1, short: "Seg", full: "Segunda" },
  { value: 2, short: "Ter", full: "Terça" },
  { value: 3, short: "Qua", full: "Quarta" },
  { value: 4, short: "Qui", full: "Quinta" },
  { value: 5, short: "Sex", full: "Sexta" },
  { value: 6, short: "Sáb", full: "Sábado" },
  { value: 0, short: "Dom", full: "Domingo" },
];

type ProAvailRow = {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
type ProBreakRow = {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string | null;
};

function toHm(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t;
}
function isValidRange(start: string, end: string) {
  return /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && start < end;
}

function AvailabilityStep({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pros, isLoading: loadingPros } = useQuery({
    queryKey: ["professionals", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const [selectedProId, setSelectedProId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProId && pros && pros.length > 0) setSelectedProId(pros[0].id);
  }, [pros, selectedProId]);

  const [finishing, setFinishing] = useState(false);

  const onFinish = async () => {
    setFinishing(true);
    await queryClient.invalidateQueries();
    toast.success("Tudo pronto! 🚀");
    navigate({ to: "/dashboard", replace: true });
  };

  if (loadingPros) {
    return (
      <div className="surface-card p-8 flex justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pros || pros.length === 0) {
    return (
      <div className="space-y-6">
        <div className="surface-card p-8 space-y-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Passo 4 de 4</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Disponibilidade</h1>
          <p className="text-sm text-muted-foreground">
            Você ainda não cadastrou profissionais. Configure a disponibilidade depois no painel.
          </p>
        </div>
        <div className="flex justify-end">
          <button onClick={onFinish} disabled={finishing} className="btn-primary disabled:opacity-60">
            {finishing ? <Loader2 className="size-4 animate-spin" /> : <>Concluir <ArrowRight className="size-4" /></>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-card p-8 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Passo 4 de 4</p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Defina a disponibilidade
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dias e horários de atendimento e pausas de cada profissional. Ajuste depois quando quiser.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {pros.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProId(p.id)}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                (selectedProId === p.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {p.name}
            </button>
          ))}
        </div>

        {selectedProId && (
          <ProfessionalAvailabilityEditor
            key={selectedProId}
            companyId={companyId}
            professionalId={selectedProId}
            allProfessionals={pros}
          />
        )}
      </div>

      <div className="flex justify-between gap-3">
        <button onClick={onFinish} disabled={finishing} className="btn-ghost">
          Pular por agora
        </button>
        <button onClick={onFinish} disabled={finishing} className="btn-primary disabled:opacity-60">
          {finishing ? <Loader2 className="size-4 animate-spin" /> : <>Concluir <ArrowRight className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

function ProfessionalAvailabilityEditor({
  companyId,
  professionalId,
  allProfessionals,
}: {
  companyId: string;
  professionalId: string;
  allProfessionals: { id: string; name: string }[];
}) {
  const { data: avail, refetch: refetchAvail, isLoading: loadingA } = useQuery({
    queryKey: ["prof-avail", professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_availability")
        .select("id, professional_id, day_of_week, start_time, end_time")
        .eq("professional_id", professionalId)
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return data as ProAvailRow[];
    },
  });

  const { data: breaks, refetch: refetchBreaks, isLoading: loadingB } = useQuery({
    queryKey: ["prof-breaks", professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_breaks")
        .select("id, professional_id, day_of_week, start_time, end_time, label")
        .eq("professional_id", professionalId)
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return data as ProBreakRow[];
    },
  });

  const [copyOpen, setCopyOpen] = useState(false);

  const availByDay = useMemo(() => {
    const map: Record<number, ProAvailRow[]> = {};
    (avail ?? []).forEach((r) => {
      map[r.day_of_week] = map[r.day_of_week] ?? [];
      map[r.day_of_week].push(r);
    });
    return map;
  }, [avail]);

  const breaksByDay = useMemo(() => {
    const map: Record<number, ProBreakRow[]> = {};
    (breaks ?? []).forEach((r) => {
      map[r.day_of_week] = map[r.day_of_week] ?? [];
      map[r.day_of_week].push(r);
    });
    return map;
  }, [breaks]);

  const toggleDay = async (day: number, enable: boolean) => {
    if (enable) {
      const { error } = await supabase.from("professional_availability").insert({
        company_id: companyId,
        professional_id: professionalId,
        day_of_week: day,
        start_time: "09:00",
        end_time: "18:00",
      });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("professional_availability")
        .delete()
        .eq("professional_id", professionalId)
        .eq("day_of_week", day);
      if (error) return toast.error(error.message);
      await supabase
        .from("professional_breaks")
        .delete()
        .eq("professional_id", professionalId)
        .eq("day_of_week", day);
    }
    await Promise.all([refetchAvail(), refetchBreaks()]);
  };

  const updateWindow = async (id: string, patch: Partial<Pick<ProAvailRow, "start_time" | "end_time">>) => {
    const { error } = await supabase.from("professional_availability").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await refetchAvail();
  };

  const addWindow = async (day: number) => {
    const existing = availByDay[day] ?? [];
    const last = existing[existing.length - 1];
    const start = last ? bumpTime(last.end_time, 30) : "09:00";
    const end = bumpTime(start, 60);
    const { error } = await supabase.from("professional_availability").insert({
      company_id: companyId,
      professional_id: professionalId,
      day_of_week: day,
      start_time: start,
      end_time: end,
    });
    if (error) return toast.error(error.message);
    await refetchAvail();
  };

  const removeWindow = async (id: string) => {
    const { error } = await supabase.from("professional_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refetchAvail();
  };

  const addBreak = async (day: number) => {
    const { error } = await supabase.from("professional_breaks").insert({
      company_id: companyId,
      professional_id: professionalId,
      day_of_week: day,
      start_time: "12:00",
      end_time: "13:00",
      label: "Almoço",
    });
    if (error) return toast.error(error.message);
    await refetchBreaks();
  };

  const updateBreak = async (
    id: string,
    patch: Partial<Pick<ProBreakRow, "start_time" | "end_time" | "label">>,
  ) => {
    const { error } = await supabase.from("professional_breaks").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await refetchBreaks();
  };

  const removeBreak = async (id: string) => {
    const { error } = await supabase.from("professional_breaks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refetchBreaks();
  };

  const applyPreset = async (preset: "weekdays" | "everyday" | "clear") => {
    // Clear all
    await supabase.from("professional_availability").delete().eq("professional_id", professionalId);
    await supabase.from("professional_breaks").delete().eq("professional_id", professionalId);
    if (preset === "clear") {
      await Promise.all([refetchAvail(), refetchBreaks()]);
      return;
    }
    const days = preset === "weekdays" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    const rows = days.map((d) => ({
      company_id: companyId,
      professional_id: professionalId,
      day_of_week: d,
      start_time: "09:00",
      end_time: "18:00",
    }));
    const { error } = await supabase.from("professional_availability").insert(rows);
    if (error) return toast.error(error.message);
    await Promise.all([refetchAvail(), refetchBreaks()]);
    toast.success("Horários aplicados");
  };

  const copyToProfessional = async (targetId: string) => {
    if (targetId === professionalId) return;
    await supabase.from("professional_availability").delete().eq("professional_id", targetId);
    await supabase.from("professional_breaks").delete().eq("professional_id", targetId);
    if (avail && avail.length > 0) {
      const rows = avail.map((r) => ({
        company_id: companyId,
        professional_id: targetId,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
      }));
      const { error } = await supabase.from("professional_availability").insert(rows);
      if (error) return toast.error(error.message);
    }
    if (breaks && breaks.length > 0) {
      const rows = breaks.map((r) => ({
        company_id: companyId,
        professional_id: targetId,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        label: r.label,
      }));
      const { error } = await supabase.from("professional_breaks").insert(rows);
      if (error) return toast.error(error.message);
    }
    setCopyOpen(false);
    toast.success("Copiado com sucesso");
  };

  if (loadingA || loadingB) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Presets:</span>
        <button type="button" onClick={() => applyPreset("weekdays")} className="chip">Seg–Sex 9h–18h</button>
        <button type="button" onClick={() => applyPreset("everyday")} className="chip">Todos os dias 9h–18h</button>
        <button type="button" onClick={() => applyPreset("clear")} className="chip">Limpar</button>
        {allProfessionals.length > 1 && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setCopyOpen((v) => !v)}
              className="chip inline-flex items-center gap-1.5"
            >
              <Copy className="size-3.5" /> Copiar para...
            </button>
            {copyOpen && (
              <div className="absolute right-0 mt-1 z-10 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg">
                {allProfessionals
                  .filter((p) => p.id !== professionalId)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => copyToProfessional(p.id)}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {WEEKDAYS.map(({ value, short, full }) => {
          const dayWindows = availByDay[value] ?? [];
          const dayBreaks = breaksByDay[value] ?? [];
          const enabled = dayWindows.length > 0;
          return (
            <li key={value} className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch checked={enabled} onCheckedChange={(v) => toggleDay(value, v)} />
                  <div>
                    <p className="text-sm font-medium">{full}</p>
                    <p className="text-[11px] text-muted-foreground">{enabled ? `${dayWindows.length} janela${dayWindows.length > 1 ? "s" : ""}` : "Fechado"}</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground sm:hidden">{short}</span>
              </div>

              {enabled && (
                <div className="mt-3 space-y-2">
                  {dayWindows.map((w) => (
                    <div key={w.id} className="flex items-center gap-2">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <TimeInput
                        value={toHm(w.start_time)}
                        onCommit={(v) => {
                          if (!isValidRange(v, toHm(w.end_time))) return toast.error("Horário inválido");
                          updateWindow(w.id, { start_time: v });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <TimeInput
                        value={toHm(w.end_time)}
                        onCommit={(v) => {
                          if (!isValidRange(toHm(w.start_time), v)) return toast.error("Horário inválido");
                          updateWindow(w.id, { end_time: v });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeWindow(w.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive p-1"
                        aria-label="Remover janela"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  {dayBreaks.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <Coffee className="size-3.5 text-warning/80" />
                      <input
                        defaultValue={b.label ?? ""}
                        placeholder="Pausa"
                        onBlur={(e) => {
                          const val = e.target.value.trim().slice(0, 40);
                          if (val !== (b.label ?? "")) updateBreak(b.id, { label: val || null });
                        }}
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                      />
                      <TimeInput
                        value={toHm(b.start_time)}
                        onCommit={(v) => {
                          if (!isValidRange(v, toHm(b.end_time))) return toast.error("Horário inválido");
                          updateBreak(b.id, { start_time: v });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <TimeInput
                        value={toHm(b.end_time)}
                        onCommit={(v) => {
                          if (!isValidRange(toHm(b.start_time), v)) return toast.error("Horário inválido");
                          updateBreak(b.id, { end_time: v });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeBreak(b.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive p-1"
                        aria-label="Remover pausa"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => addWindow(value)}
                      className="chip inline-flex items-center gap-1"
                    >
                      <Plus className="size-3" /> Janela
                    </button>
                    <button
                      type="button"
                      onClick={() => addBreak(value)}
                      className="chip inline-flex items-center gap-1"
                    >
                      <Coffee className="size-3" /> Pausa
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TimeInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="time"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]"
    />
  );
}

function bumpTime(hm: string, minutes: number) {
  const [h, m] = hm.slice(0, 5).split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

