-- Tighten public INSERT policy on bookings with server-side invariants
DROP POLICY IF EXISTS "Public can create bookings for active resources" ON public.bookings;

CREATE POLICY "Public can create bookings for active resources"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND start_at >= (now() - interval '2 minutes')
  AND end_at > start_at
  AND char_length(btrim(customer_name)) BETWEEN 2 AND 120
  AND char_length(btrim(customer_phone)) BETWEEN 6 AND 30
  AND (customer_email IS NULL OR (char_length(customer_email) BETWEEN 3 AND 255 AND customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
  AND (notes IS NULL OR char_length(notes) <= 1000)
  AND EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = bookings.service_id
      AND s.company_id = bookings.company_id
      AND s.status = 'active'
      AND ROUND(EXTRACT(EPOCH FROM (bookings.end_at - bookings.start_at))/60)::int = s.duration_minutes
  )
  AND EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = bookings.professional_id
      AND p.company_id = bookings.company_id
      AND p.status = 'active'
  )
);

-- Persistent length caps (survive updates too)
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_name_len
    CHECK (char_length(customer_name) BETWEEN 1 AND 120);

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_phone_len
    CHECK (char_length(customer_phone) BETWEEN 1 AND 30);

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_email_len
    CHECK (customer_email IS NULL OR char_length(customer_email) <= 255);

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_notes_len
    CHECK (notes IS NULL OR char_length(notes) <= 1000);

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_cancellation_reason_len
    CHECK (cancellation_reason IS NULL OR char_length(cancellation_reason) <= 500);