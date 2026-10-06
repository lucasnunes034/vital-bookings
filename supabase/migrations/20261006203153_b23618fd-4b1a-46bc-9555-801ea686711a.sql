
CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = auth.uid())
$$;

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_members_email_chk CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  UNIQUE (company_id, email)
);
CREATE INDEX company_members_email_idx ON public.company_members (lower(email));
CREATE INDEX company_members_user_idx ON public.company_members (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = _company_id
        AND (m.user_id = auth.uid()
             OR (m.user_id IS NULL AND lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_owner(uuid) TO authenticated;

-- Link pending invites to the signed-in user's account
CREATE OR REPLACE FUNCTION public.claim_company_invites()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.company_members SET user_id = auth.uid(), updated_at = now()
  WHERE user_id IS NULL AND auth.uid() IS NOT NULL
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
REVOKE EXECUTE ON FUNCTION public.claim_company_invites() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_company_invites() TO authenticated;

CREATE POLICY "members owner manage" ON public.company_members FOR ALL TO authenticated
  USING (public.is_company_owner(company_id)) WITH CHECK (public.is_company_owner(company_id));
CREATE POLICY "members read own team" ON public.company_members FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- Revenues (financeiro)
CREATE TABLE public.revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  received_at date NOT NULL DEFAULT current_date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX revenues_booking_unique ON public.revenues (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX revenues_company_date_idx ON public.revenues (company_id, received_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenues TO authenticated;
GRANT ALL ON public.revenues TO service_role;
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenues tenant manage" ON public.revenues FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER revenues_touch BEFORE UPDATE ON public.revenues FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER company_members_touch BEFORE UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Companies: members can read their company (owner-only writes stay)
CREATE POLICY "companies member read" ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(id));

-- Replace owner-only tenant policies with tenant (owner + team) policies
DROP POLICY IF EXISTS "Owners can view reschedule history" ON public.booking_reschedule_history;
CREATE POLICY "tenant read reschedule history" ON public.booking_reschedule_history FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Owners update own company bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owners delete own company bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owners select own company bookings" ON public.bookings;
CREATE POLICY "tenant select bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "tenant update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "tenant delete bookings" ON public.bookings FOR DELETE TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS owner_manage_reviews ON public.company_reviews;
CREATE POLICY "tenant manage reviews" ON public.company_reviews FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "theme owner manage" ON public.company_theme_settings;
CREATE POLICY "theme owner manage" ON public.company_theme_settings FOR ALL TO authenticated USING (public.is_company_owner(company_id)) WITH CHECK (public.is_company_owner(company_id));
CREATE POLICY "theme member read" ON public.company_theme_settings FOR SELECT TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "customers owner manage" ON public.customers;
CREATE POLICY "tenant manage customers" ON public.customers FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "owner manages templates" ON public.message_templates;
CREATE POLICY "tenant manage templates" ON public.message_templates FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "payment_intents owner manage" ON public.payment_intents;
CREATE POLICY "tenant manage payment_intents" ON public.payment_intents FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "payment_settings owner manage" ON public.payment_settings;
CREATE POLICY "payment_settings owner manage" ON public.payment_settings FOR ALL TO authenticated USING (public.is_company_owner(company_id)) WITH CHECK (public.is_company_owner(company_id));
CREATE POLICY "payment_settings member read" ON public.payment_settings FOR SELECT TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Owners manage availability" ON public.professional_availability;
CREATE POLICY "tenant manage availability" ON public.professional_availability FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "Owners manage breaks" ON public.professional_breaks;
CREATE POLICY "tenant manage breaks" ON public.professional_breaks FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "professionals owner delete" ON public.professionals;
DROP POLICY IF EXISTS "professionals owner update" ON public.professionals;
DROP POLICY IF EXISTS "professionals owner insert" ON public.professionals;
DROP POLICY IF EXISTS "professionals owner read" ON public.professionals;
CREATE POLICY "tenant manage professionals" ON public.professionals FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS quote_items_owner_all ON public.quote_items;
CREATE POLICY "tenant manage quote_items" ON public.quote_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND public.is_company_member(q.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND public.is_company_member(q.company_id)));
DROP POLICY IF EXISTS quotes_owner_all ON public.quotes;
CREATE POLICY "tenant manage quotes" ON public.quotes FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "services owner update" ON public.services;
DROP POLICY IF EXISTS "services owner read" ON public.services;
DROP POLICY IF EXISTS "services owner insert" ON public.services;
DROP POLICY IF EXISTS "services owner delete" ON public.services;
CREATE POLICY "tenant manage services" ON public.services FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
