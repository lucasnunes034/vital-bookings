CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_company_id_idx ON public.services(company_id);

GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services public read active"
ON public.services FOR SELECT
TO anon
USING (status = 'active');

CREATE POLICY "services owner read"
ON public.services FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = services.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "services owner insert"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = services.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "services owner update"
ON public.services FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = services.company_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = services.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "services owner delete"
ON public.services FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = services.company_id AND c.owner_id = auth.uid()));

CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();