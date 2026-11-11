import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { applyTheme, resetTheme } from "@/lib/theme/apply";
import type { CompanyTheme, ThemeFont, ThemeMode, ThemeTemplateId } from "@/lib/theme/types";

function normalize(row: any): CompanyTheme {
  // Se não vier linha nenhuma do banco, cria um objeto vazio para forçar as cores padrão
  const safeRow = row || {};

  return {
    company_id: safeRow.company_id ?? "default",
    template_id: (safeRow.template_id ?? "default") as ThemeTemplateId,
    // Cores de fallback: se a cor for null, assume o padrão automaticamente
    primary_color: safeRow.primary_color ?? "#6366f1",
    secondary_color: safeRow.secondary_color ?? "#4f46e5",
    accent_color: safeRow.accent_color ?? "#818cf8",
    theme_mode: (safeRow.theme_mode ?? "dark") as ThemeMode,
    font_family: (safeRow.font_family ?? "Inter") as ThemeFont,
    logo_url: safeRow.logo_url ?? null,
    favicon_url: safeRow.favicon_url ?? null,
    banner_url: safeRow.banner_url ?? null,
    display_name: safeRow.display_name ?? null,
    tagline: safeRow.tagline ?? null,
  };
}

/** Applies theme for the current user's first company (authenticated shell). */
export function CompanyThemeApplier({ companyId }: { companyId?: string | null }) {
  const q = useQuery({
    queryKey: ["company-theme", companyId ?? "none"],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_theme_settings")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return normalize(data);
    },
  });

  useEffect(() => {
    if (q.data) applyTheme(q.data);
    return () => {
      // don't reset on unmount to avoid FOUC during route changes
    };
  }, [q.data]);

  return null;
}

/** Applies theme for a public company page by slug. */
export function PublicThemeApplier({ slug }: { slug: string }) {
  usePublicTheme(slug);
  return null;
}

/**
 * Fetches and applies the public theme for a slug. Returns `ready = true`
 * once the theme has been applied (or the fetch has settled), so callers
 * can gate rendering to avoid a flash of default colors.
 */
export function usePublicTheme(slug: string) {
  const q = useQuery({
    queryKey: ["public-company-theme", slug],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_theme_by_slug", { _slug: slug });
      if (error) throw error;
      return normalize(data);
    },
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Como o normalize agora sempre retorna um objeto válido (nunca null), q.data sempre vai acionar o ready
    if (q.data) {
      applyTheme(q.data);
      setReady(true);
    } else if (q.isError) {
      setReady(true);
    }
  }, [q.data, q.isError]);

  useEffect(() => {
    return () => resetTheme();
  }, []);

  return { ready };
}

export { applyTheme, resetTheme };
