import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CompanyThemeApplier } from "@/components/theme-provider";
import { isSubscriptionBlocked } from "@/lib/subscription";

function AuthedShell() {
  const q = useQuery({
    queryKey: ["my-company-first-id"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
  });
  return (
    <>
      <CompanyThemeApplier companyId={q.data} />
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Super admin nunca é bloqueado pela assinatura.
    if ((data.user.email ?? "").toLowerCase() === "lucasnunes239@gmail.com") {
      return { user: data.user };
    }

    // SubscriptionGuard: bloqueia o painel quando a assinatura expirou/cancelou.
    const { data: companies } = await supabase
      .from("companies")
      .select("id, subscription_status, subscription_ends_at")
      .order("created_at", { ascending: true })
      .limit(1);
    const company = companies?.[0] ?? null;
    if (company && isSubscriptionBlocked(company)) {
      throw redirect({ to: "/billing/pending" });
    }

    return { user: data.user };
  },
  component: AuthedShell,
});
