import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, LogOut, MessageCircle, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { SUPPORT_WHATSAPP, subscriptionReason, type CompanySubscription } from "@/lib/subscription";

export const Route = createFileRoute("/billing/pending")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assinatura pendente · Slotly" },
      { name: "description", content: "Renove sua assinatura do Slotly para voltar a acessar sua agenda, clientes e orçamentos." },
      { property: "og:title", content: "Assinatura pendente · Slotly" },
      { property: "og:description", content: "Renove sua assinatura para reativar o acesso ao painel Slotly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPendingPage,
});

function BillingPendingPage() {
  const q = useQuery({
    queryKey: ["my-company-subscription"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, subscription_status, subscription_ends_at")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as (CompanySubscription & { name: string }) | null;
    },
  });

  const message = `Olá! Sou responsável pela empresa ${q.data?.name ?? ""} no Slotly e quero renovar minha assinatura.`;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Acesso temporariamente bloqueado</CardTitle>
          <CardDescription className="text-balance">
            {subscriptionReason(q.data)} Para continuar usando a agenda, clientes e orçamentos, renove sua assinatura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Seus dados continuam salvos com segurança e voltam a ficar disponíveis assim que a assinatura for reativada.
          </p>
          <Button asChild className="w-full h-12 text-base">
            <a href={buildWhatsappUrl(SUPPORT_WHATSAPP, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-5" /> Renovar assinatura no WhatsApp
            </a>
          </Button>
          <Button variant="outline" className="w-full h-11" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCcw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Já paguei, verificar novamente
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            <LogOut className="size-4" /> Sair da conta
          </Button>
          <div className="text-center">
            <Link to="/" className="text-xs text-muted-foreground underline underline-offset-4">
              Voltar para a página inicial
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}