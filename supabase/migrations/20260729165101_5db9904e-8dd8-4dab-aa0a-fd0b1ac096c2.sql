
-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela quotes
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  valid_until date,
  notes text,
  status public.quote_status NOT NULL DEFAULT 'draft',
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  total_cents integer NOT NULL DEFAULT 0,
  quote_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX quotes_public_token_uidx ON public.quotes(public_token);
CREATE INDEX quotes_company_created_idx ON public.quotes(company_id, created_at DESC);
CREATE UNIQUE INDEX quotes_company_number_uidx ON public.quotes(company_id, quote_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_owner_all" ON public.quotes
  FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- Tabela quote_items
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents integer NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  total_cents integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_items_quote_idx ON public.quote_items(quote_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_items_owner_all" ON public.quote_items
  FOR ALL TO authenticated
  USING (quote_id IN (
    SELECT q.id FROM public.quotes q
    JOIN public.companies c ON c.id = q.company_id
    WHERE c.owner_id = auth.uid()
  ))
  WITH CHECK (quote_id IN (
    SELECT q.id FROM public.quotes q
    JOIN public.companies c ON c.id = q.company_id
    WHERE c.owner_id = auth.uid()
  ));

-- updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER quotes_touch_updated BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER quote_items_touch_updated BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Auto quote_number por empresa
CREATE OR REPLACE FUNCTION public.tg_assign_quote_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = 0 THEN
    SELECT COALESCE(MAX(quote_number), 0) + 1 INTO NEW.quote_number
    FROM public.quotes WHERE company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quotes_assign_number BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_assign_quote_number();

-- Recalcula totais em cada mutação de itens
CREATE OR REPLACE FUNCTION public.tg_quote_item_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    NEW.total_cents := ROUND(NEW.quantity * NEW.unit_price_cents)::int;
    v_quote_id := NEW.quote_id;
  END IF;

  UPDATE public.quotes
    SET total_cents = COALESCE((
      SELECT SUM(total_cents)::int FROM public.quote_items WHERE quote_id = v_quote_id
    ), 0),
    updated_at = now()
  WHERE id = v_quote_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER quote_items_recalc_ins BEFORE INSERT OR UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_item_totals();
CREATE TRIGGER quote_items_recalc_after AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_item_totals();

-- Função pública para acesso via token
CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_quote public.quotes;
  v_company public.companies;
  v_items jsonb;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = v_quote.company_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', qi.id,
      'description', qi.description,
      'quantity', qi.quantity,
      'unit_price_cents', qi.unit_price_cents,
      'total_cents', qi.total_cents,
      'position', qi.position
    ) ORDER BY qi.position
  ), '[]'::jsonb) INTO v_items
  FROM public.quote_items qi WHERE qi.quote_id = v_quote.id;

  RETURN jsonb_build_object(
    'quote', jsonb_build_object(
      'id', v_quote.id,
      'quote_number', v_quote.quote_number,
      'customer_name', v_quote.customer_name,
      'customer_phone', v_quote.customer_phone,
      'customer_email', v_quote.customer_email,
      'valid_until', v_quote.valid_until,
      'notes', v_quote.notes,
      'status', v_quote.status,
      'total_cents', v_quote.total_cents,
      'created_at', v_quote.created_at
    ),
    'company', jsonb_build_object(
      'name', v_company.name,
      'phone', v_company.phone,
      'logo_url', v_company.logo_url,
      'address', v_company.address,
      'slug', v_company.slug
    ),
    'items', v_items
  );
END $$;

REVOKE ALL ON FUNCTION public.get_quote_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quote_by_token(uuid) TO anon, authenticated;
