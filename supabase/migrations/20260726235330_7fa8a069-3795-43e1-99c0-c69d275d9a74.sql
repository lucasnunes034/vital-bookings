-- Tipos de mensagem
DO $$ BEGIN
  CREATE TYPE public.message_kind AS ENUM ('confirmation','reschedule','cancellation','reminder_24h','reminder_1h');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind public.message_kind NOT NULL,
  body text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

CREATE TRIGGER trg_message_templates_updated
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rastreamento de lembretes enviados
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

-- Textos padrão por tipo
CREATE OR REPLACE FUNCTION public.default_message_body(_kind public.message_kind)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _kind
    WHEN 'confirmation'  THEN E'Olá {cliente}! ✅\n\nSeu agendamento em *{empresa}* foi confirmado:\n\n• Serviço: {servico}\n• Profissional: {profissional}\n• Data: {data} às {hora}\n• Duração: {duracao} min\n\nQualquer alteração é só falar comigo por aqui.\nGerenciar ou cancelar: {link_gerenciar}'
    WHEN 'reschedule'    THEN E'Olá {cliente}! 🔁\n\nSeu agendamento em *{empresa}* foi remarcado.\n\nNovo horário:\n• {data} às {hora}\n• {servico} com {profissional}\n\nGerenciar: {link_gerenciar}'
    WHEN 'cancellation'  THEN E'Olá {cliente}. ❌\n\nSeu agendamento em *{empresa}* para {data} às {hora} foi cancelado.\n\nSe quiser, é só me chamar por aqui para reagendarmos.'
    WHEN 'reminder_24h'  THEN E'Oi {cliente}! 👋\n\nLembrete do seu horário amanhã em *{empresa}*:\n\n• {servico} com {profissional}\n• {data} às {hora}\n\nAté lá! Precisa remarcar? {link_gerenciar}'
    WHEN 'reminder_1h'   THEN E'Oi {cliente}! ⏰\n\nSeu horário em *{empresa}* é daqui a pouco:\n\n• {servico} com {profissional}\n• Hoje às {hora}\n\nTe espero!'
  END;
$$;

-- Preencher modelos ao criar empresa
CREATE OR REPLACE FUNCTION public.seed_message_templates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.message_templates (company_id, kind, body)
  SELECT NEW.id, k, public.default_message_body(k)
  FROM unnest(ARRAY['confirmation','reschedule','cancellation','reminder_24h','reminder_1h']::public.message_kind[]) AS k
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_seed_message_templates ON public.companies;
CREATE TRIGGER trg_seed_message_templates
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_message_templates();

-- Backfill para empresas existentes
INSERT INTO public.message_templates (company_id, kind, body)
SELECT c.id, k, public.default_message_body(k)
FROM public.companies c
CROSS JOIN unnest(ARRAY['confirmation','reschedule','cancellation','reminder_24h','reminder_1h']::public.message_kind[]) AS k
ON CONFLICT DO NOTHING;