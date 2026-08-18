import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, MoreHorizontal, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SUPER_ADMIN_EMAIL = "lucasnunes239@gmail.com";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase() ?? "";
    if (email !== SUPER_ADMIN_EMAIL) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Torre de Controle · Slotly" },
      { name: "description", content: "Painel interno para gerenciar assinaturas das empresas cadastradas no Slotly." },
      { property: "og:title", content: "Torre de Controle · Slotly" },
      { property: "og:description", content: "Gerencie assinaturas, status e vencimentos das empresas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminPage,
});

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  created_at: string;
};

type ActionKind = "activate" | "suspend" | "extend_trial";

function statusMeta(status: string | null) {
  switch (status ?? "trial") {
    case "active":
      return { label: "Ativa", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
    case "trial":
      return { label: "Teste", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
    case "past_due":
      return { label: "Pagamento pendente", className: "bg-destructive/15 text-destructive border-destructive/30" };
    case "canceled":
      return { label: "Cancelada", className: "bg-destructive/15 text-destructive border-destructive/30" };
    default:
      return { label: status ?? "—", className: "bg-muted text-muted-foreground border-border" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function nextValues(kind: ActionKind, company: CompanyRow) {
  const now = Date.now();
  if (kind === "activate") {
    return {
      subscription_status: "active",
      subscription_ends_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (kind === "suspend") {
    return { subscription_status: "past_due" };
  }
  const base = company.subscription_ends_at ? new Date(company.subscription_ends_at).getTime() : now;
  const from = Number.isFinite(base) && base > now ? base : now;
  return {
    subscription_status: "trial",
    subscription_ends_at: new Date(from + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function SuperAdminPage() {
  const queryClient = useQueryClient();

  const companies = useQuery({
    queryKey: ["super-admin-companies"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, subscription_status, subscription_ends_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CompanyRow[];
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ kind, company }: { kind: ActionKind; company: CompanyRow }) => {
      const { error } = await supabase
        .from("companies")
        .update(nextValues(kind, company))
        .eq("id", company.id);
      if (error) throw error;
      return kind;
    },
    onSuccess: (kind) => {
      const msg =
        kind === "activate"
          ? "Mensalidade ativada por 30 dias."
          : kind === "suspend"
            ? "Acesso suspenso (pagamento pendente)."
            : "Trial estendido por mais 7 dias.";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a assinatura.");
    },
  });

  const rows = companies.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <ShieldCheck className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Torre de Controle</h1>
            <p className="text-sm text-muted-foreground">Gerencie as assinaturas de todas as empresas cadastradas.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas ({rows.length})</CardTitle>
            <CardDescription>Status, vencimento e ações rápidas de assinatura.</CardDescription>
          </CardHeader>
          <CardContent>
            {companies.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : companies.isError ? (
              <p className="text-sm text-destructive">Não foi possível carregar as empresas.</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="hidden md:table-cell">Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((company) => {
                      const meta = statusMeta(company.subscription_status);
                      return (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">
                            {company.name}
                            <span className="block text-xs text-muted-foreground md:hidden">/{company.slug}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <a
                              href={`/${company.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                            >
                              /{company.slug}
                              <ExternalLink className="size-3.5" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {formatDate(company.subscription_ends_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Ações de ${company.name}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Assinatura</DropdownMenuLabel>
                                <DropdownMenuItem
                                  disabled={mutation.isPending}
                                  onSelect={() => mutation.mutate({ kind: "activate", company })}
                                >
                                  Ativar mensalidade (30 dias)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={mutation.isPending}
                                  onSelect={() => mutation.mutate({ kind: "suspend", company })}
                                >
                                  Suspender acesso
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={mutation.isPending}
                                  onSelect={() => mutation.mutate({ kind: "extend_trial", company })}
                                >
                                  Estender trial (+7 dias)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}