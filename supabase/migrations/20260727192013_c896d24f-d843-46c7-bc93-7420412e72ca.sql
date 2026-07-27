
CREATE TABLE public.company_theme_settings (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL DEFAULT 'default',
  primary_color TEXT NOT NULL DEFAULT '#5E6AD2',
  secondary_color TEXT NOT NULL DEFAULT '#8B5CF6',
  accent_color TEXT NOT NULL DEFAULT '#10B981',
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('light','dark','auto')),
  font_family TEXT NOT NULL DEFAULT 'Inter' CHECK (font_family IN ('Inter','Poppins','Roboto','Montserrat')),
  logo_url TEXT,
  favicon_url TEXT,
  banner_url TEXT,
  display_name TEXT,
  tagline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_theme_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_theme_settings TO authenticated;
GRANT ALL ON public.company_theme_settings TO service_role;

ALTER TABLE public.company_theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "theme public read"
  ON public.company_theme_settings FOR SELECT
  USING (true);

CREATE POLICY "theme owner manage"
  ON public.company_theme_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_company_theme_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER update_company_theme_settings_updated_at
  BEFORE UPDATE ON public.company_theme_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_company_theme_touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_company_theme_by_slug(_slug TEXT)
RETURNS public.company_theme_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM public.company_theme_settings t
  JOIN public.companies c ON c.id = t.company_id
  WHERE c.slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_theme_by_slug(TEXT) TO anon, authenticated;
