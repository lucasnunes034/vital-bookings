CREATE TABLE public.professionals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialties text[] NOT NULL DEFAULT '{}',
  skill_level text NOT NULL DEFAULT 'intermediario' CHECK (skill_level IN ('iniciante','intermediario','avancado','especialista')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX professionals_company_id_idx ON public.professionals(company_id);

GRANT SELECT ON public.professionals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professionals public read active"
ON public.professionals FOR SELECT
TO anon
USING (status = 'active');

CREATE POLICY "professionals owner read"
ON public.professionals FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = professionals.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "professionals owner insert"
ON public.professionals FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = professionals.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "professionals owner update"
ON public.professionals FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = professionals.company_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = professionals.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "professionals owner delete"
ON public.professionals FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = professionals.company_id AND c.owner_id = auth.uid()));

CREATE TRIGGER professionals_set_updated_at
BEFORE UPDATE ON public.professionals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();