
-- 1) payment_settings: drop public read policy (exposes provider_config)
DROP POLICY IF EXISTS "payment_settings public read" ON public.payment_settings;
REVOKE SELECT ON public.payment_settings FROM anon;

-- 2) Prevent authenticated owner updates from changing manage_token (defense in depth)
REVOKE UPDATE (manage_token) ON public.bookings FROM authenticated, anon;

-- 3) Revoke EXECUTE from PUBLIC on internal/trigger SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_message_templates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_payment_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_booking_reschedule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_company_reviews_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_company_reviews_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_company_theme_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_expired_payment_intents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.default_message_body(public.message_kind) FROM PUBLIC, anon, authenticated;

-- 4) Add fixed search_path to helper functions missing it
CREATE OR REPLACE FUNCTION public.tg_company_theme_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.default_message_body(_kind public.message_kind)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _kind
    WHEN 'confirmation'  THEN E'Olá {cliente}! ✅\n\nSeu agendamento em *{empresa}* foi confirmado:\n\n• Serviço: {servico}\n• Profissional: {profissional}\n• Data: {data} às {hora}\n• Duração: {duracao} min\n\nQualquer alteração é só falar comigo por aqui.\nGerenciar ou cancelar: {link_gerenciar}'
    WHEN 'reschedule'    THEN E'Olá {cliente}! 🔁\n\nSeu agendamento em *{empresa}* foi remarcado.\n\nNovo horário:\n• {data} às {hora}\n• {servico} com {profissional}\n\nGerenciar: {link_gerenciar}'
    WHEN 'cancellation'  THEN E'Olá {cliente}. ❌\n\nSeu agendamento em *{empresa}* para {data} às {hora} foi cancelado.\n\nSe quiser, é só me chamar por aqui para reagendarmos.'
    WHEN 'reminder_24h'  THEN E'Oi {cliente}! 👋\n\nLembrete do seu horário amanhã em *{empresa}*:\n\n• {servico} com {profissional}\n• {data} às {hora}\n\nAté lá! Precisa remarcar? {link_gerenciar}'
    WHEN 'reminder_1h'   THEN E'Oi {cliente}! ⏰\n\nSeu horário em *{empresa}* é daqui a pouco:\n\n• {servico} com {profissional}\n• Hoje às {hora}\n\nTe espero!'
  END;
$$;

-- Re-revoke after CREATE OR REPLACE (recreation restores default PUBLIC EXECUTE)
REVOKE EXECUTE ON FUNCTION public.tg_company_theme_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.default_message_body(public.message_kind) FROM PUBLIC, anon, authenticated;
