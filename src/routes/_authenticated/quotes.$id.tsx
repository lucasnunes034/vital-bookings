import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Link2, MessageCircle, Loader2, Printer, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatCents, QUOTE_STATUS_LABEL, quoteNumberLabel, buildQuoteWhatsAppMessage } from "@/lib/quotes";
import { buildWhatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/quotes/$id")({
  head: () => ({
    meta: [
      { title: "Orçamento · Slotly" },
      { name: "description", content: "Visualização do orçamento pronto para envio." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuoteViewPage,
});

function QuoteViewPage() {
  const { id } = Route.useParams();
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data: quote, error } = await supabase
        .from("quotes")
        .select("*, company:companies(id, name, phone, logo_url, address, slug)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!quote) return null;
      const { data: items, error: iErr } = await supabase
        .from("quote_items")
        .select("id, description, quantity, unit_price_cents, total_cents, position")
        .eq("quote_id", id)
        .order("position");
      if (iErr) throw iErr;
      return { quote, items: items ?? [] };
    },
  });

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!q.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Orçamento não encontrado.</p>
        <Link to="/quotes" className="btn-ghost h-9 text-sm">Voltar</Link>
      </div>
    );
  }

  const { quote, items } = q.data as any;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${quote.public_token}` : "";

  const waMessage = buildQuoteWhatsAppMessage({
    customerName: quote.customer_name,
    companyName: quote.company?.name,
    totalCents: quote.total_cents,
    validUntil: quote.valid_until,
    publicUrl,
  });

  function handleSendWhatsApp() {
    const phone = quote.customer_phone;
    if (!phone || !String(phone).replace(/\D/g, "")) {
      toast.error("Telefone do cliente não cadastrado. Preencha o telefone no cadastro do orçamento para enviar pelo WhatsApp.");
      return;
    }
    const url = buildWhatsappUrl(phone, waMessage);
    // Try a true top-level popup first. In sandboxed preview iframes the popup
    // may be blocked and the browser would otherwise fall back to navigating
    // this frame to api.whatsapp.com (X-Frame-Options -> ERR_BLOCKED_BY_RESPONSE).
    // When that happens, copy the link instead of leaving the iframe broken.
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Abrir nova aba foi bloqueado pelo navegador", {
        description: "O link do WhatsApp foi copiado — cole na barra de endereço para abrir.",
      });
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link público copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-40 print:hidden">
        <div className="container-page flex h-16 items-center justify-between gap-2">
          <Link to="/quotes" className="btn-ghost h-9 !px-3 text-sm">
            <ArrowLeft className="size-4" /> Orçamentos
          </Link>
          <div className="hidden sm:flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="btn-ghost h-9 text-sm">
              <Printer className="size-4" /> Imprimir
            </button>
            <button onClick={copyLink} className="btn-ghost h-9 text-sm">
              {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />} Gerar link público
            </button>
            <button onClick={handleSendWhatsApp}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: "#25D366" }}>
              <MessageCircle className="size-4" /> Enviar por WhatsApp
            </button>
          </div>
        </div>
      </header>

      <div className="sm:hidden container-page pt-4 space-y-2 print:hidden">
        <button onClick={handleSendWhatsApp}
          className="inline-flex w-full items-center justify-center gap-1.5 h-14 px-4 rounded-md text-base font-medium text-white shadow-sm transition hover:opacity-90"
          style={{ backgroundColor: "#25D366" }}>
          <MessageCircle className="size-5" /> Enviar por WhatsApp
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyLink} className="btn-ghost w-full h-12 text-sm justify-center">
            {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />} Link público
          </button>
          <button onClick={() => window.print()} className="btn-ghost w-full h-12 text-sm justify-center">
            <Printer className="size-4" /> Imprimir
          </button>
        </div>
      </div>

      <main className="container-page py-10 max-w-4xl">
        <QuoteDocument quote={quote} items={items} company={quote.company} />
      </main>
    </div>
  );
}

export function QuoteDocument({ quote, items, company }: { quote: any; items: any[]; company: any }) {
  return (
    <article className="surface-card p-8 md:p-12 print:shadow-none print:border-0 space-y-8">
      <header className="flex items-start justify-between gap-6 border-b border-border/60 pb-6">
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
            {company?.phone && <p className="text-xs text-muted-foreground truncate">{company.phone}</p>}
            {company?.address && <p className="text-xs text-muted-foreground truncate">{company.address}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Orçamento</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{quoteNumberLabel(quote.quote_number)}</p>
          <span className="mt-1 inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border bg-muted text-muted-foreground border-border">
            {QUOTE_STATUS_LABEL[quote.status] ?? quote.status}
          </span>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</p>
          <p className="mt-1 font-medium">{quote.customer_name}</p>
          {quote.customer_phone && <p className="text-sm text-muted-foreground">{quote.customer_phone}</p>}
          {quote.customer_email && <p className="text-sm text-muted-foreground">{quote.customer_email}</p>}
        </div>
        <div className="md:text-right space-y-1 text-sm">
          <p><span className="text-muted-foreground">Emitido em: </span>{new Date(quote.created_at).toLocaleDateString("pt-BR")}</p>
          {quote.valid_until && (
            <p><span className="text-muted-foreground">Válido até: </span>{new Date(quote.valid_until).toLocaleDateString("pt-BR")}</p>
          )}
        </div>
      </section>

      <section>
        {/* Mobile: card list */}
        <div className="md:hidden space-y-3">
          {items.map((i: any) => (
            <div key={i.id} className="rounded-lg border border-border/60 p-3 space-y-2">
              <p className="text-sm font-medium break-words">{i.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Qtd: <span className="text-foreground tabular-nums">{Number(i.quantity)}</span></span>
                <span>Unit: <span className="text-foreground tabular-nums">{formatCents(i.unit_price_cents)}</span></span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">{formatCents(i.total_cents)}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-2 border-border pt-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Total geral</span>
            <span className="font-display text-xl font-semibold tabular-nums">{formatCents(quote.total_cents)}</span>
          </div>
        </div>

        {/* Desktop: table */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <th className="py-2 pr-2 font-medium">Descrição</th>
              <th className="py-2 pr-2 font-medium text-right w-20">Qtd.</th>
              <th className="py-2 pr-2 font-medium text-right w-32">Unitário</th>
              <th className="py-2 pr-2 font-medium text-right w-32">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((i: any) => (
              <tr key={i.id}>
                <td className="py-3 pr-2">{i.description}</td>
                <td className="py-3 pr-2 text-right tabular-nums">{Number(i.quantity)}</td>
                <td className="py-3 pr-2 text-right tabular-nums">{formatCents(i.unit_price_cents)}</td>
                <td className="py-3 pr-2 text-right tabular-nums font-medium">{formatCents(i.total_cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={3} className="py-4 text-right text-sm uppercase tracking-wider text-muted-foreground">Total geral</td>
              <td className="py-4 text-right font-display text-2xl font-semibold tabular-nums">{formatCents(quote.total_cents)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {quote.notes && (
        <section>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Observações</p>
          <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
        </section>
      )}

      <footer className="pt-6 border-t border-border/60 text-xs text-muted-foreground text-center">
        Documento gerado eletronicamente por {company?.name}. Valores em Reais (BRL).
      </footer>
    </article>
  );
}