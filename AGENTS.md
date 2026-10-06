<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Tenant access in RLS goes through public.is_company_member(company_id) (owner or company_members row) and is_company_owner for owner-only settings; why: one place defines multi-tenant isolation and team access.
- Team members inherit the parent company subscription (paywall reads the company row); why: billing is per company, not per user.
