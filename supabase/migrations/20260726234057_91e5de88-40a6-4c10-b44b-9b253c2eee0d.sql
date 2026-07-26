-- Ensure is_active columns exist FIRST (referenced later)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='is_active') THEN
    ALTER TABLE public.services ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='professionals' AND column_name='is_active') THEN
    ALTER TABLE public.professionals ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- ============ COMPANIES ============
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviews_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_desc_len_chk,
  ADD CONSTRAINT companies_desc_len_chk CHECK (
    (tagline IS NULL OR char_length(tagline) <= 140) AND
    (description IS NULL OR char_length(description) <= 4000) AND
    (address IS NULL OR char_length(address) <= 300)
  );

-- ============ PROFESSIONALS ============
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_bio_len_chk,
  ADD CONSTRAINT professionals_bio_len_chk CHECK (bio IS NULL OR char_length(bio) <= 500);

-- ============ SERVICES ============
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_desc_len_chk,
  ADD CONSTRAINT services_desc_len_chk CHECK (description IS NULL OR char_length(description) <= 500);

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS public.company_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 800),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

GRANT SELECT ON public.company_reviews TO anon;
GRANT SELECT, UPDATE, DELETE ON public.company_reviews TO authenticated;
GRANT ALL ON public.company_reviews TO service_role;

ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_reviews" ON public.company_reviews;
CREATE POLICY "public_read_published_reviews" ON public.company_reviews
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "owner_manage_reviews" ON public.company_reviews;
CREATE POLICY "owner_manage_reviews" ON public.company_reviews
  FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS company_reviews_company_created_idx
  ON public.company_reviews (company_id, created_at DESC);

DROP TRIGGER IF EXISTS company_reviews_set_updated_at ON public.company_reviews;
CREATE TRIGGER company_reviews_set_updated_at
  BEFORE UPDATE ON public.company_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recompute_company_reviews_stats(_company_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.companies c
  SET reviews_count = COALESCE(s.cnt, 0),
      reviews_avg   = COALESCE(s.avg, 0)
  FROM (
    SELECT count(*)::int AS cnt, round(avg(rating)::numeric, 2) AS avg
    FROM public.company_reviews
    WHERE company_id = _company_id AND is_published = true
  ) s
  WHERE c.id = _company_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_company_reviews_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_company_reviews_stats(OLD.company_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_company_reviews_stats(NEW.company_id);
    IF TG_OP = 'UPDATE' AND OLD.company_id <> NEW.company_id THEN
      PERFORM public.recompute_company_reviews_stats(OLD.company_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS company_reviews_stats_trg ON public.company_reviews;
CREATE TRIGGER company_reviews_stats_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.company_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_company_reviews_stats();

CREATE OR REPLACE FUNCTION public.submit_review_by_token(
  _token uuid,
  _rating smallint,
  _comment text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b record;
  _review_id uuid;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING ERRCODE = 'P0001';
  END IF;
  IF _comment IS NOT NULL AND char_length(_comment) > 800 THEN
    RAISE EXCEPTION 'comment_too_long' USING ERRCODE = 'P0001';
  END IF;
  SELECT b.id, b.company_id, b.professional_id, b.customer_name, b.status, b.end_at
    INTO _b
  FROM public.bookings b
  WHERE b.manage_token = _token;
  IF _b.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _b.status NOT IN ('confirmed','completed') THEN
    RAISE EXCEPTION 'not_reviewable' USING ERRCODE = 'P0001';
  END IF;
  IF _b.end_at > now() THEN
    RAISE EXCEPTION 'booking_not_finished' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.company_reviews (
    company_id, booking_id, professional_id, customer_name, rating, comment
  ) VALUES (
    _b.company_id, _b.id, _b.professional_id, _b.customer_name, _rating, NULLIF(trim(_comment), '')
  )
  ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        is_published = true,
        updated_at = now()
  RETURNING id INTO _review_id;
  RETURN _review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review_by_token(uuid, smallint, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_company_by_slug(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(c) - 'owner_id' ||
    jsonb_build_object(
      'services', COALESCE((
        SELECT jsonb_agg(to_jsonb(s) ORDER BY s.display_order, s.name)
        FROM public.services s
        WHERE s.company_id = c.id AND s.is_active = true
      ), '[]'::jsonb),
      'professionals', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'name', p.name, 'photo_url', p.photo_url,
            'bio', p.bio, 'display_order', p.display_order
          ) ORDER BY p.display_order, p.name
        )
        FROM public.professionals p
        WHERE p.company_id = c.id AND p.is_active = true
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
