ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_subscription_status_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_subscription_status_check
  CHECK (subscription_status IN ('trial','active','past_due','canceled'));

UPDATE public.companies
SET subscription_ends_at = created_at + interval '14 days'
WHERE subscription_ends_at IS NULL;