import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { applyTheme, resetTheme } from "@/lib/theme/apply";
import type { CompanyTheme, ThemeFont, ThemeMode, ThemeTemplateId } from "@/lib/theme/types";

function normalize(row: any): CompanyTheme | null {
  if (!row) return null;
  return {
    company_id: row.company_id,
    template_id: (row.template_id ?? "default") as ThemeTemplateId,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    accent_color: row.accent_color,
    theme_mode: (row.theme_mode ?? "dark") as ThemeMode,
    font_family: (row.font_family ?? "Inter") as ThemeFont,
    logo_url: row.logo_url ?? null,
    favicon_url: row.favicon_url ?? null,
    banner_url: row.banner_url ?? null,
    display_name: row.display_name ?? null,
    tagline: row.tagline ?? null,
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