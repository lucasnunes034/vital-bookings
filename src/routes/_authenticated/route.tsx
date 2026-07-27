import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CompanyThemeApplier } from "@/components/theme-provider";

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
    return { user: data.user };
  },
  component: AuthedShell,
});
