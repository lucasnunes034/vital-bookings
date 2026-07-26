
CREATE TABLE public.booking_reschedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  previous_start_at timestamptz NOT NULL,
  previous_end_at timestamptz NOT NULL,
  new_start_at timestamptz NOT NULL,
  new_end_at timestamptz NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner','customer','system')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_reschedule_history TO authenticated;
GRANT ALL ON public.booking_reschedule_history TO service_role;

ALTER TABLE public.booking_reschedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view reschedule history"
  ON public.booking_reschedule_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = booking_reschedule_history.company_id AND c.owner_id = auth.uid()
  ));

CREATE INDEX idx_brh_booking ON public.booking_reschedule_history (booking_id, created_at DESC);
CREATE INDEX idx_brh_company ON public.booking_reschedule_history (company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_booking_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _src text;
BEGIN
  IF NEW.start_at = OLD.start_at AND NEW.end_at = OLD.end_at THEN
    RETURN NEW;
  END IF;
  _src := CASE WHEN _uid IS NULL THEN 'customer' ELSE 'owner' END;
  INSERT INTO public.booking_reschedule_history(
    booking_id, company_id, previous_start_at, previous_end_at,
    new_start_at, new_end_at, changed_by, source
  ) VALUES (
    NEW.id, NEW.company_id, OLD.start_at, OLD.end_at,
    NEW.start_at, NEW.end_at, _uid, _src
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_booking_reschedule ON public.bookings;
CREATE TRIGGER trg_log_booking_reschedule
  AFTER UPDATE OF start_at, end_at ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_booking_reschedule();
