import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Loader2, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatCents, QUOTE_STATUS_LABEL, quoteNumberLabel } from "@/lib/quotes";

export const Route = createFileRoute("/_authenticated/quotes/")({
  head: () => ({
    meta: [
      { title: "Orçamentos · Slotly" },
      { name: "description", content: "Crie, envie e acompanhe orçamentos dos seus clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuotesListPage,
});

function statusTone(s: string) {
  switch (s) {
    case "accepted": return "bg-success/10 text-success border-success/30";
    case "sent": return "bg-primary/10 text-primary border-primary/30";
    case "rejected": return "bg-destructive/10 text-destructive border-destructive/30";
    case "expired": return "bg-warning/10 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function QuotesListPage() {
  const q = useQuery({
    queryKey: ["quotes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_name, status, total_cents, valid_until, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/dashboard" className="btn-ghost h-9 !px-3 text-sm">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <Link to="/quotes/new" className="btn-primary h-9 text-sm">
            <Plus className="size-4" /> Novo orçamento
          </Link>
        </div>
      </header>
      <main className="container-page min-w-0 py-10 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gestão</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight mt-1 flex items-center gap-2">
            <FileText className="size-6 text-muted-foreground" /> Orçamentos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie propostas comerciais, gere links públicos e envie por WhatsApp.</p>
        </div>

        <div className="surface-card p-0 overflow-hidden">
          {q.isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="py-16 text-center px-6">
              <FileText className="size-8 mx-auto text-muted-foreground" />
              <h2 className="mt-3 font-display text-lg font-semibold">Nenhum orçamento ainda</h2>
              <p className="mt-1 text-sm text-muted-foreground">Comece criando seu primeiro orçamento para enviar ao cliente.</p>
              <Link to="/quotes/new" className="btn-primary mt-4 h-9 text-sm inline-flex">
                <Plus className="size-4" /> Criar orçamento
              </Link>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <th className="py-3 px-4 font-medium">Número</th>
                    <th className="py-3 px-4 font-medium">Cliente</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Validade</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {q.data!.map((row: any) => (
                    <tr key={row.id} className="hover:bg-accent/40 cursor-pointer">
                      <td className="py-3 px-4 font-mono">
                        <Link to="/quotes/$id" params={{ id: row.id }} className="hover:underline">
                          {quoteNumberLabel(row.quote_number)}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link to="/quotes/$id" params={{ id: row.id }} className="block">{row.customer_name}</Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-md border ${statusTone(row.status)}`}>
                          {QUOTE_STATUS_LABEL[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {row.valid_until ? new Date(row.valid_until).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{formatCents(row.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-border/60">
              {q.data!.map((row: any) => (
                <Link
                  key={row.id}
                  to="/quotes/$id"
                  params={{ id: row.id }}
                  className="block p-4 hover:bg-accent/40 active:bg-accent/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.customer_name}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{quoteNumberLabel(row.quote_number)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums">{formatCents(row.total_cents)}</p>
                      <span className={`mt-1 inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border ${statusTone(row.status)}`}>
                        {QUOTE_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </div>
                  </div>
                  {row.valid_until && (
                    <p className="mt-2 text-[11px] text-muted-foreground">Válido até {new Date(row.valid_until).toLocaleDateString("pt-BR")}</p>
                  )}
                </Link>
              ))}
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}