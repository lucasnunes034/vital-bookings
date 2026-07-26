
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS bookings_manage_token_key ON public.bookings(manage_token);

CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
RETURNS TABLE (
  id uuid, status text, start_at timestamptz, end_at timestamptz,
  customer_name text, customer_phone text, customer_email text,
  notes text, cancellation_reason text,
  company_id uuid, company_name text, company_slug text, company_timezone text, company_segment text, company_phone text,
  service_id uuid, service_name text, duration_minutes int, price_cents int,
  professional_id uuid, professional_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.status, b.start_at, b.end_at,
         b.customer_name, b.customer_phone, b.customer_email,
         b.notes, b.cancellation_reason,
         c.id, c.name, c.slug, c.timezone, c.segment, c.phone,
         s.id, s.name, s.duration_minutes, s.price_cents,
         p.id, p.name
  FROM public.bookings b
  JOIN public.companies c ON c.id = b.company_id
  JOIN public.services s ON s.id = b.service_id
  JOIN public.professionals p ON p.id = b.professional_id
  WHERE b.manage_token = _token;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_token(_token uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _status text; _start timestamptz;
BEGIN
  SELECT id, status, start_at INTO _id, _status, _start
  FROM public.bookings WHERE manage_token = _token;
  IF _id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF _status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'not_cancellable' USING ERRCODE = 'P0001'; END IF;
  IF _start < now() THEN RAISE EXCEPTION 'past_booking' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.bookings
    SET status = 'cancelled',
        cancellation_reason = COALESCE(NULLIF(trim(_reason),''), 'Cancelado pelo cliente'),
        updated_at = now()
    WHERE id = _id;
END; $$;

CREATE OR REPLACE FUNCTION public.reschedule_booking_by_token(_token uuid, _new_start timestamptz, _new_end timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _status text; _start timestamptz; _duration int;
BEGIN
  SELECT b.id, b.status, b.start_at, s.duration_minutes
    INTO _id, _status, _start, _duration
  FROM public.bookings b
  JOIN public.services s ON s.id = b.service_id
  WHERE b.manage_token = _token;
  IF _id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF _status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'not_reschedulable' USING ERRCODE = 'P0001'; END IF;
  IF _start < now() THEN RAISE EXCEPTION 'past_booking' USING ERRCODE = 'P0001'; END IF;
  IF _new_start < now() THEN RAISE EXCEPTION 'invalid_new_time' USING ERRCODE = 'P0001'; END IF;
  IF ROUND(EXTRACT(EPOCH FROM (_new_end - _new_start))/60)::int <> _duration THEN
    RAISE EXCEPTION 'wrong_duration' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.bookings
    SET start_at = _new_start, end_at = _new_end, status = 'pending', updated_at = now()
    WHERE id = _id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_by_token(uuid, timestamptz, timestamptz) TO anon, authenticated;
