CREATE OR REPLACE FUNCTION public.get_busy_slots(
  _professional_id uuid,
  _date date,
  _timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.start_at, b.end_at
  FROM public.bookings b
  WHERE b.professional_id = _professional_id
    AND b.status IN ('pending','confirmed')
    AND (b.start_at AT TIME ZONE _timezone)::date = _date;
$function$;