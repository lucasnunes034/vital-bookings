import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatCents, QUOTE_STATUS_LABEL, quoteNumberLabel } from "@/lib/quotes";

export const Route = createFileRoute("/q/$token")({
  head: () => ({
    meta: [
      { title: "Orçamento" },
      { name: "description", content: "Visualização pública do orçamento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicQuotePage,
});

function PublicQuotePage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-quote", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quote_by_token" as any, { _token: token });
      if (error) throw error;
      return data as any;
    },
  });

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="size-6 animate-spin text-gray-400" /></div>;
  }
  if (!q.data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gray-50">
        Orçamento não encontrado ou link inválido.
      </div>
    );
  }

  const { quote, items, company } = q.data;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 py-8 md:py-14">
      <main className="container-page max-w-3xl mx-auto">
        <article className="bg-white p-8 md:p-12 space-y-8 shadow-sm border border-gray-200 min-h-[1056px]">
          <header className="flex items-start justify-between gap-6 border-b border-gray-200 pb-6">
            <div className="flex items-center gap-3 min-w-0">
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company?.name} className="size-14 rounded-md object-cover" />
              ) : (
                <div className="size-14 rounded-md grid place-items-center text-white font-display text-lg" style={{ background: "var(--gradient-brand)" }}>
                  {(company?.name ?? "?").slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-xl font-semibold truncate">{company?.name}</h1>
                {company?.phone && <p className="text-xs text-gray-500 truncate">{company.phone}</p>}
                {company?.address && <p className="text-xs text-gray-500 truncate">{company.address}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Orçamento</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{quoteNumberLabel(quote.quote_number)}</p>
              <span className="mt-1 inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border bg-gray-100 text-gray-500 border-gray-200">
                {QUOTE_STATUS_LABEL[quote.status] ?? quote.status}
              </span>
            </div>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Cliente</p>
              <p className="mt-1 font-medium">{quote.customer_name}</p>
              {quote.customer_phone && <p className="text-sm text-gray-500">{quote.customer_phone}</p>}
              {quote.customer_email && <p className="text-sm text-gray-500">{quote.customer_email}</p>}
            </div>
            <div className="md:text-right space-y-1 text-sm">
              <p><span className="text-gray-500">Emitido em: </span>{new Date(quote.created_at).toLocaleDateString("pt-BR")}</p>
              {quote.valid_until && (
                <p><span className="text-gray-500">Válido até: </span>{new Date(quote.valid_until).toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          </section>

          <section>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-2 font-medium">Descrição</th>
                  <th className="py-2 pr-2 font-medium text-right w-20">Qtd.</th>
                  <th className="py-2 pr-2 font-medium text-right w-32">Unitário</th>
                  <th className="py-2 pr-2 font-medium text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(items ?? []).map((i: any) => (
                  <tr key={i.id}>
                    <td className="py-3 pr-2">{i.description}</td>
                    <td className="py-3 pr-2 text-right tabular-nums">{Number(i.quantity)}</td>
                    <td className="py-3 pr-2 text-right tabular-nums">{formatCents(i.unit_price_cents)}</td>
                    <td className="py-3 pr-2 text-right tabular-nums font-medium">{formatCents(i.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={3} className="py-4 text-right text-sm uppercase tracking-wider text-gray-500">Total geral</td>
                  <td className="py-4 text-right font-display text-2xl font-semibold tabular-nums">{formatCents(quote.total_cents)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {quote.notes && (
            <section>
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Observações</p>
              <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
            </section>
          )}

          <footer className="pt-6 border-t border-gray-200 text-xs text-gray-500 text-center">
            Documento gerado eletronicamente por {company?.name}. Valores em Reais (BRL).
          </footer>
        </article>
      </main>
    </div>
  );
}