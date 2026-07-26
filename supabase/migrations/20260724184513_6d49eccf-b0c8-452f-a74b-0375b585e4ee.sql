
-- Bookings table
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes text,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX bookings_company_start_idx ON public.bookings (company_id, start_at);
CREATE INDEX bookings_professional_start_idx ON public.bookings (professional_id, start_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT INSERT ON public.bookings TO anon;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Owners manage bookings of their company
CREATE POLICY "Owners select own company bookings"
ON public.bookings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = bookings.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "Owners update own company bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = bookings.company_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = bookings.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "Owners delete own company bookings"
ON public.bookings FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = bookings.company_id AND c.owner_id = auth.uid()));

-- Public can insert if service+professional belong to same active company
CREATE POLICY "Public can create bookings for active resources"
ON public.bookings FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = bookings.service_id
      AND s.company_id = bookings.company_id
      AND s.status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = bookings.professional_id
      AND p.company_id = bookings.company_id
      AND p.status = 'active'
  )
);

CREATE TRIGGER bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public RPC: return only busy time-ranges for a professional on a given date, no PII
CREATE OR REPLACE FUNCTION public.get_busy_slots(_professional_id uuid, _date date)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.start_at, b.end_at
  FROM public.bookings b
  WHERE b.professional_id = _professional_id
    AND b.status IN ('pending','confirmed')
    AND b.start_at::date = _date;
$$;

REVOKE ALL ON FUNCTION public.get_busy_slots(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(uuid, date) TO anon, authenticated;
