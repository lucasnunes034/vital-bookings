create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (auth.jwt() ->> 'email') = 'lucasnunes239@gmail.com'),
    false
  )
$$;

revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "companies super admin read" on public.companies;
create policy "companies super admin read"
on public.companies for select to authenticated
using (public.is_super_admin());

drop policy if exists "companies super admin update" on public.companies;
create policy "companies super admin update"
on public.companies for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());