
-- 1) Remove broad anon SELECT on companies; public page uses get_public_company_by_slug (excludes owner_id)
DROP POLICY IF EXISTS "companies public read" ON public.companies;
REVOKE SELECT ON public.companies FROM anon;

-- 2) Scoped self-service RLS for bookings via manage_token request header
DROP POLICY IF EXISTS "Customers view own booking by token" ON public.bookings;
CREATE POLICY "Customers view own booking by token"
  ON public.bookings
  FOR SELECT
  TO anon, authenticated
  USING (
    manage_token IS NOT NULL
    AND manage_token::text = current_setting('request.headers', true)::json->>'x-manage-token'
  );

DROP POLICY IF EXISTS "Customers cancel own booking by token" ON public.bookings;
CREATE POLICY "Customers cancel own booking by token"
  ON public.bookings
  FOR UPDATE
  TO anon, authenticated
  USING (
    manage_token IS NOT NULL
    AND manage_token::text = current_setting('request.headers', true)::json->>'x-manage-token'
  )
  WITH CHECK (
    manage_token IS NOT NULL
    AND manage_token::text = current_setting('request.headers', true)::json->>'x-manage-token'
  );
