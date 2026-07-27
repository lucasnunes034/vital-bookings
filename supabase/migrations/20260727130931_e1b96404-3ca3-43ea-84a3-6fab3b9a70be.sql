-- =========================================================
-- Payments architecture (no gateway integration yet)
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.payment_mode AS ENUM ('none','fixed','percentage','full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_intent_status AS ENUM ('pending','paid','expired','cancelled','refunded','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------
-- payment_settings (one per company)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_settings (
  company_id           uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled              boolean NOT NULL DEFAULT false,
  mode                 public.payment_mode NOT NULL DEFAULT 'none',
  fixed_amount_cents   integer NOT NULL DEFAULT 0 CHECK (fixed_amount_cents >= 0),
  percentage           numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  currency             text NOT NULL DEFAULT 'BRL',
  provider             text,                              -- 'stripe' | 'mercado_pago' | 'asaas' | 'pagseguro' | null
  provider_config      jsonb NOT NULL DEFAULT '{}'::jsonb,-- credenciais/opções específicas do provedor
  expires_after_minutes integer NOT NULL DEFAULT 30 CHECK (expires_after_minutes BETWEEN 5 AND 1440),
  require_per_service  boolean NOT NULL DEFAULT false,    -- se true, respeita services.requires_payment; senão cobra em todos
  cancellation_policy  text,                              -- texto livre exibido ao cliente
  refund_policy        text,                              -- texto livre exibido ao cliente
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT SELECT ON public.payment_settings TO anon;
GRANT ALL ON public.payment_settings TO service_role;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_settings owner manage"
  ON public.payment_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = payment_settings.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = payment_settings.company_id AND c.owner_id = auth.uid()));

-- público lê apenas campos usados no checkout (leitura irrestrita, mas os campos sensíveis ficam em provider_config)
CREATE POLICY "payment_settings public read"
  ON public.payment_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER payment_settings_set_updated_at
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed automático: cria linha default quando a empresa é criada
CREATE OR REPLACE FUNCTION public.seed_payment_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_settings (company_id) VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS companies_seed_payment_settings ON public.companies;
CREATE TRIGGER companies_seed_payment_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_payment_settings();

-- Backfill para empresas já existentes
INSERT INTO public.payment_settings (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- ---------------------------------------------------------
-- services.requires_payment
-- ---------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS requires_payment boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------
-- payment_intents (one per attempt; latest active drives booking state)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider              text NOT NULL,                  -- 'manual' | 'stripe' | 'mercado_pago' | 'asaas' | 'pagseguro'
  provider_intent_id    text,                           -- id no provedor (ex.: pi_xxx)
  checkout_url          text,                           -- URL para o cliente pagar
  amount_cents          integer NOT NULL CHECK (amount_cents >= 0),
  currency              text NOT NULL DEFAULT 'BRL',
  status                public.payment_intent_status NOT NULL DEFAULT 'pending',
  failure_reason        text,
  expires_at            timestamptz,
  paid_at               timestamptz,
  refunded_at           timestamptz,
  raw_payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_intents_booking_idx  ON public.payment_intents(booking_id);
CREATE INDEX IF NOT EXISTS payment_intents_company_idx  ON public.payment_intents(company_id);
CREATE INDEX IF NOT EXISTS payment_intents_status_idx   ON public.payment_intents(status);
CREATE INDEX IF NOT EXISTS payment_intents_expires_idx  ON public.payment_intents(expires_at) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_intents TO authenticated;
GRANT SELECT ON public.payment_intents TO anon;
GRANT ALL ON public.payment_intents TO service_role;

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_intents owner manage"
  ON public.payment_intents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = payment_intents.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = payment_intents.company_id AND c.owner_id = auth.uid()));

-- Cliente final acessa via função SECURITY DEFINER (get_payment_intent_by_token); nenhuma leitura direta necessária.

CREATE TRIGGER payment_intents_set_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------

-- Marca intents pendentes vencidos como expirados e cancela os agendamentos correspondentes
CREATE OR REPLACE FUNCTION public.release_expired_payment_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.payment_intents
       SET status = 'expired', updated_at = now()
     WHERE status = 'pending'
       AND expires_at IS NOT NULL
       AND expires_at < now()
     RETURNING booking_id
  )
  UPDATE public.bookings b
     SET status = 'cancelled',
         cancellation_reason = COALESCE(b.cancellation_reason, 'Pagamento não concluído no prazo'),
         updated_at = now()
    FROM expired
   WHERE b.id = expired.booking_id
     AND b.status IN ('pending');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END; $$;

-- Leitura pública do intent ativo por token do agendamento (para futura tela de checkout)
CREATE OR REPLACE FUNCTION public.get_payment_intent_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  booking_id uuid,
  provider text,
  checkout_url text,
  amount_cents integer,
  currency text,
  status public.payment_intent_status,
  expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pi.id, pi.booking_id, pi.provider, pi.checkout_url,
         pi.amount_cents, pi.currency, pi.status, pi.expires_at
    FROM public.payment_intents pi
    JOIN public.bookings b ON b.id = pi.booking_id
   WHERE b.manage_token = _token
   ORDER BY pi.created_at DESC
   LIMIT 1;
$$;