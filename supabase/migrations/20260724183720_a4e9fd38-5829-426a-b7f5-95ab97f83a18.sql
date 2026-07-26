
-- Availability windows per professional per weekday
CREATE TABLE public.professional_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

GRANT SELECT ON public.professional_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_availability TO authenticated;
GRANT ALL ON public.professional_availability TO service_role;

ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads availability of active professionals"
  ON public.professional_availability FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = professional_availability.professional_id AND p.status = 'active'
  ));

CREATE POLICY "Owners manage availability"
  ON public.professional_availability FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = professional_availability.company_id AND c.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = professional_availability.company_id AND c.owner_id = auth.uid()
  ));

CREATE INDEX idx_prof_avail_prof ON public.professional_availability(professional_id, day_of_week);

CREATE TRIGGER trg_prof_avail_updated
  BEFORE UPDATE ON public.professional_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Breaks within a day per professional
CREATE TABLE public.professional_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

GRANT SELECT ON public.professional_breaks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_breaks TO authenticated;
GRANT ALL ON public.professional_breaks TO service_role;

ALTER TABLE public.professional_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads breaks of active professionals"
  ON public.professional_breaks FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = professional_breaks.professional_id AND p.status = 'active'
  ));

CREATE POLICY "Owners manage breaks"
  ON public.professional_breaks FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = professional_breaks.company_id AND c.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = professional_breaks.company_id AND c.owner_id = auth.uid()
  ));

CREATE INDEX idx_prof_breaks_prof ON public.professional_breaks(professional_id, day_of_week);

CREATE TRIGGER trg_prof_breaks_updated
  BEFORE UPDATE ON public.professional_breaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
