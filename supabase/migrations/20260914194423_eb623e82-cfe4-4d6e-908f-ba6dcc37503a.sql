ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cpf text;
CREATE UNIQUE INDEX IF NOT EXISTS companies_cpf_unique ON public.companies (cpf) WHERE cpf IS NOT NULL;