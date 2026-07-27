import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, RotateCcw, Sparkles, Sun, Moon, Monitor, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MediaUploader } from "@/components/media-uploader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { applyTheme } from "@/lib/theme/apply";
import { contrastRatio, ensureReadable, isValidHex } from "@/lib/theme/contrast";
import { TEMPLATE_PRESETS, getTemplate } from "@/lib/theme/templates";
import { DEFAULT_THEME, type CompanyTheme, type ThemeFont, type ThemeMode, type ThemeTemplateId } from "@/lib/theme/types";

const FONTS: ThemeFont[] = ["Inter", "Poppins", "Roboto", "Montserrat"];

type Draft = Omit<CompanyTheme, "company_id">;

export function AppearanceTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const savedRef = useRef<Draft | null>(null);

  const q = useQuery({
    queryKey: ["appearance", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_theme_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as (CompanyTheme | null);
    },
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (q.data) {
      const next: Draft = { ...DEFAULT_THEME, ...q.data };
      savedRef.current = next;
      setDraft(next);
    } else if (q.isFetched && !q.data && !draft) {
      savedRef.current = { ...DEFAULT_THEME };
      setDraft({ ...DEFAULT_THEME });
    }
  }, [q.data, q.isFetched]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview: apply draft to :root as it changes.
  useEffect(() => {
    if (!draft) return;
    applyTheme({ company_id: companyId, ...draft });
  }, [draft, companyId]);

  // Revert on unmount if not saved.
  useEffect(() => {
    return () => {
      if (savedRef.current) applyTheme({ company_id: companyId, ...savedRef.current });
    };
  }, [companyId]);

  const save = useMutation({
    mutationFn: async (payload: Draft) => {
      const { error } = await supabase
        .from("company_theme_settings")
        .upsert({ company_id: companyId, ...payload }, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aparência salva");
      if (draft) savedRef.current = draft;
      qc.invalidateQueries({ queryKey: ["company-theme", companyId] });
      qc.invalidateQueries({ queryKey: ["appearance", companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  if (q.isLoading || !draft) {
    return <div className="flex justify-center p-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const applyTemplate = (id: ThemeTemplateId) => {
    const t = getTemplate(id);
    setDraft((d) => d ? {
      ...d,
      template_id: id,
      primary_color: t.primary,
      secondary_color: t.secondary,
      accent_color: t.accent,
      font_family: t.font,
    } : d);
  };

  const bg = draft.theme_mode === "light" ? "#FFFFFF" : "#0F0F14";
  const primaryCheck = ensureReadable(draft.primary_color, bg, 2.5);
  const secondaryCheck = ensureReadable(draft.secondary_color, bg, 2.5);
  const accentCheck = ensureReadable(draft.accent_color, bg, 2.5);

  const isDirty = savedRef.current && JSON.stringify(savedRef.current) !== JSON.stringify(draft);

  return (
    <div className="space-y-6">
      <div className="surface-card p-5 space-y-4">
        <div>
          <h3 className="font-medium">Templates prontos</h3>
          <p className="text-xs text-muted-foreground">Aplica uma paleta e fonte harmoniosa para o segmento.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {TEMPLATE_PRESETS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className={`text-left rounded-xl border p-3 transition-all ${
                draft.template_id === t.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{t.emoji}</span>
                <span className="text-sm font-medium">{t.label}</span>
              </div>
              <div className="mt-2 flex gap-1">
                <span className="size-4 rounded-full" style={{ background: t.primary }} />
                <span className="size-4 rounded-full" style={{ background: t.secondary }} />
                <span className="size-4 rounded-full" style={{ background: t.accent }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-5 space-y-4">
          <h3 className="font-medium">Identidade</h3>
          <div className="space-y-2">
            <Label>Nome exibido</Label>
            <Input value={draft.display_name ?? ""} onChange={(e) => set("display_name", e.target.value || null)} placeholder="Nome da empresa" />
          </div>
          <div className="space-y-2">
            <Label>Slogan</Label>
            <Input value={draft.tagline ?? ""} onChange={(e) => set("tagline", e.target.value || null)} placeholder="Ex: Beleza que transforma" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <MediaUploader companyId={companyId} value={draft.logo_url} onChange={(u) => set("logo_url", u)} folder="theme" />
            </div>
            <div className="space-y-2">
              <Label>Favicon</Label>
              <MediaUploader companyId={companyId} value={draft.favicon_url} onChange={(u) => set("favicon_url", u)} folder="theme" />
            </div>
            <div className="space-y-2">
              <Label>Banner</Label>
              <MediaUploader companyId={companyId} value={draft.banner_url} onChange={(u) => set("banner_url", u)} folder="theme" />
            </div>
          </div>
        </div>

        <div className="surface-card p-5 space-y-4">
          <h3 className="font-medium">Paleta</h3>
          <ColorField
            label="Cor primária"
            hint="Botões, links, calendário, badges"
            value={draft.primary_color}
            onChange={(v) => set("primary_color", v)}
            check={primaryCheck}
          />
          <ColorField
            label="Cor secundária"
            hint="Cards, bordas, campos"
            value={draft.secondary_color}
            onChange={(v) => set("secondary_color", v)}
            check={secondaryCheck}
          />
          <ColorField
            label="Cor de destaque"
            hint="Ações positivas, alertas de sucesso"
            value={draft.accent_color}
            onChange={(v) => set("accent_color", v)}
            check={accentCheck}
          />
        </div>

        <div className="surface-card p-5 space-y-4">
          <h3 className="font-medium">Tipografia</h3>
          <div className="space-y-2">
            <Label>Fonte</Label>
            <Select value={draft.font_family} onValueChange={(v) => set("font_family", v as ThemeFont)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border p-4" style={{ fontFamily: draft.font_family }}>
            <p className="text-2xl font-semibold">Prévia da tipografia</p>
            <p className="text-sm text-muted-foreground mt-1">Assim o texto do sistema aparece para seus clientes.</p>
          </div>
        </div>

        <div className="surface-card p-5 space-y-4">
          <h3 className="font-medium">Tema</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "light" as ThemeMode, label: "Claro", Icon: Sun },
              { v: "dark" as ThemeMode, label: "Escuro", Icon: Moon },
              { v: "auto" as ThemeMode, label: "Automático", Icon: Monitor },
            ]).map(({ v, label, Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => set("theme_mode", v)}
                className={`rounded-lg border p-3 text-sm flex flex-col items-center gap-1 transition-all ${
                  draft.theme_mode === v ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/20"
                }`}
              >
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>
          <PreviewCard theme={draft} />
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end gap-2">
        <button
          type="button"
          className="btn-ghost h-10 !px-4 text-sm"
          disabled={!isDirty}
          onClick={() => { if (savedRef.current) setDraft(savedRef.current); }}
        >
          <RotateCcw className="size-4" /> Descartar
        </button>
        <button
          type="button"
          className="btn-primary h-10 !px-5 text-sm"
          disabled={!isDirty || save.isPending}
          onClick={() => save.mutate(draft)}
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar aparência
        </button>
      </div>
    </div>
  );
}

function ColorField({
  label, hint, value, onChange, check,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  check: ReturnType<typeof ensureReadable>;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = (v: string) => {
    if (isValidHex(v)) onChange(v.toUpperCase());
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex(text) ? text : "#000000"}
          onChange={(e) => { setText(e.target.value); onChange(e.target.value.toUpperCase()); }}
          className="h-10 w-14 rounded-md border border-border bg-transparent cursor-pointer"
        />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          className="font-mono uppercase"
        />
      </div>
      {check.warning ? (
        <p className="text-[11px] text-yellow-500 inline-flex items-center gap-1">
          <AlertTriangle className="size-3" /> Contraste baixo — sugerimos {check.color}
          <button type="button" className="underline ml-1" onClick={() => onChange(check.color)}>aplicar</button>
        </p>
      ) : check.adjusted ? (
        <p className="text-[11px] text-muted-foreground">Cor será ajustada automaticamente para melhor leitura.</p>
      ) : null}
    </div>
  );
}

function PreviewCard({ theme }: { theme: Draft }) {
  const bg = theme.theme_mode === "light" ? "#FFFFFF" : "#0F0F14";
  const primaryRatio = contrastRatio(theme.primary_color, bg);
  return (
    <div className="rounded-lg border border-border p-4 space-y-3" style={{ fontFamily: theme.font_family }}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-4" style={{ color: theme.primary_color }} />
        <p className="text-sm font-medium">Prévia rápida</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: theme.primary_color }}>Primário</span>
        <span className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: theme.secondary_color }}>Secundário</span>
        <span className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: theme.accent_color }}>Destaque</span>
      </div>
      <p className="text-[11px] text-muted-foreground">Contraste primário vs. fundo: {primaryRatio.toFixed(2)}:1</p>
    </div>
  );
}