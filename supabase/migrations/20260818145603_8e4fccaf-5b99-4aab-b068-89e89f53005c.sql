DROP POLICY IF EXISTS "theme public read" ON public.company_theme_settings;
REVOKE SELECT ON public.company_theme_settings FROM anon;

DROP POLICY IF EXISTS "Public reads availability of active professionals" ON public.professional_availability;
CREATE POLICY "Public reads availability of active professionals"
ON public.professional_availability
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.professionals p
  WHERE p.id = professional_availability.professional_id
    AND p.company_id = professional_availability.company_id
    AND p.status = 'active'
    AND p.is_active = true
));

DROP POLICY IF EXISTS "Public reads breaks of active professionals" ON public.professional_breaks;
CREATE POLICY "Public reads breaks of active professionals"
ON public.professional_breaks
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.professionals p
  WHERE p.id = professional_breaks.professional_id
    AND p.company_id = professional_breaks.company_id
    AND p.status = 'active'
    AND p.is_active = true
));