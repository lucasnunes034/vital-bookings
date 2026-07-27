
-- Enum de formas de pagamento presencial
DO $$ BEGIN
  CREATE TYPE public.payment_method_kind AS ENUM ('cash','pix','debit_card','credit_card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Formas aceitas pela empresa
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS accepted_payment_methods public.payment_method_kind[]
    NOT NULL DEFAULT ARRAY['cash','pix','debit_card','credit_card']::public.payment_method_kind[];

-- Forma escolhida pelo cliente no agendamento
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method_kind;

-- RPC pública precisa expor as formas aceitas
CREATE OR REPLACE FUNCTION public.get_public_company_by_slug(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(c) - 'owner_id' ||
    jsonb_build_object(
      'services', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id, 'name', s.name, 'description', s.description,
            'duration_minutes', s.duration_minutes, 'price_cents', s.price_cents,
            'photo_url', s.photo_url, 'display_order', s.display_order
          ) ORDER BY s.display_order, s.name
        )
        FROM public.services s
        WHERE s.company_id = c.id AND s.status = 'active'
      ), '[]'::jsonb),
      'professionals', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'name', p.name, 'photo_url', p.photo_url,
            'bio', p.bio, 'specialties', p.specialties, 'display_order', p.display_order
          ) ORDER BY p.display_order, p.name
        )
        FROM public.professionals p
        WHERE p.company_id = c.id AND p.status = 'active'
      ), '[]'::jsonb),
      'reviews', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id, 'customer_name', r.customer_name, 'rating', r.rating,
            'comment', r.comment, 'created_at', r.created_at,
            'professional_id', r.professional_id
          ) ORDER BY r.created_at DESC
        )
        FROM (
          SELECT * FROM public.company_reviews
          WHERE company_id = c.id AND is_published = true
          ORDER BY created_at DESC LIMIT 24
        ) r
      ), '[]'::jsonb)
    )
  FROM public.companies c
  WHERE c.slug = _slug;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_company_by_slug(text) TO anon, authenticated;
