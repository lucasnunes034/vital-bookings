import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatCents, parseMoneyToCents, centsToInput } from "@/lib/quotes";

export const Route = createFileRoute("/_authenticated/quotes/new")({
  head: () => ({
    meta: [
      { title: "Novo orçamento · Slotly" },
      { name: "description", content: "Monte um orçamento profissional em minutos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewQuotePage,
});

type Item = { key: string; description: string; quantity: string; unit: string };

function makeItem(): Item {
  return { key: crypto.randomUUID(), description: "", quantity: "1", unit: "0,00" };
}

function NewQuotePage() {
  const navigate = useNavigate();

  const companyQ = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id").order("created_at").limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
  });

  const recentCustomersQ = useQuery({
    enabled: !!companyQ.data,
    queryKey: ["recent-customers", companyQ.data],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_phone, customer_email")
        .eq("company_id", companyQ.data!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Map<string, { name: string; phone: string | null; email: string | null }>();
      for (const r of data ?? []) {
        const k = (r.customer_phone || r.customer_name || "").toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.set(k, { name: r.customer_name, phone: r.customer_phone, email: r.customer_email });
      }
      return Array.from(seen.values()).slice(0, 20);
    },
  });

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([makeItem()]);
  const [saving, setSaving] = useState(false);

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeItem(key: string) {
    setItems((arr) => (arr.length === 1 ? arr : arr.filter((i) => i.key !== key)));
  }

  const totalCents = items.reduce((sum, i) => {
    const q = parseFloat(i.quantity.replace(",", ".")) || 0;
    return sum + Math.round(q * parseMoneyToCents(i.unit));
  }, 0);

  function pickCustomer(c: { name: string; phone: string | null; email: string | null }) {
    setCustomerName(c.name);
    setCustomerPhone(c.phone ?? "");
    setCustomerEmail(c.email ?? "");
  }

  async function save() {
    if (!companyQ.data) return;
    if (!customerName.trim()) { toast.error("Informe o nome do cliente"); return; }
    const cleanItems = items
      .map((i, idx) => ({
        description: i.description.trim(),
        quantity: Math.max(parseFloat(i.quantity.replace(",", ".")) || 0, 0),
        unit_price_cents: parseMoneyToCents(i.unit),
        position: idx,
      }))
      .filter((i) => i.description && i.quantity > 0);
    if (cleanItems.length === 0) { toast.error("Adicione ao menos um item ao orçamento"); return; }

    setSaving(true);
    try {
      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .insert({
          company_id: companyQ.data,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          customer_email: customerEmail.trim() || null,
          valid_until: validUntil || null,
          notes: notes.trim() || null,
          quote_number: 0,
        } as any)
        .select("id")
        .single();
      if (qErr) throw qErr;

      const { error: iErr } = await supabase
        .from("quote_items")
        .insert(cleanItems.map((i) => ({ ...i, quote_id: quote!.id })) as any);
      if (iErr) throw iErr;

      toast.success("Orçamento criado");
      navigate({ to: "/quotes/$id", params: { id: quote!.id } });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o orçamento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="container-page grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-between">
          <Link to="/quotes" className="btn-ghost h-9 !px-3 text-sm">
            <ArrowLeft className="size-4" /> Orçamentos
          </Link>
          <button onClick={save} disabled={saving} className="btn-primary h-9 shrink-0 text-sm">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="hidden sm:inline">Salvar orçamento</span>
          </button>
        </div>
      </header>

      <main className="container-page min-w-0 py-8 md:py-10 space-y-6 max-w-5xl">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Novo</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">Novo orçamento</h1>
        </div>

        <section className="surface-card p-4 md:p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Nome *</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input mt-1 w-full" maxLength={120} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">WhatsApp / Telefone</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input mt-1 w-full" placeholder="(11) 99999-0000" maxLength={30} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">E-mail</label>
              <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="input mt-1 w-full" maxLength={255} />
            </div>
          </div>
          {(recentCustomersQ.data ?? []).length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Clientes recentes</p>
              <div className="flex flex-wrap gap-1.5">
                {recentCustomersQ.data!.slice(0, 10).map((c, i) => (
                  <button key={i} type="button" onClick={() => pickCustomer(c)} className="btn-ghost h-7 !px-2 text-xs">
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="surface-card p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Itens do orçamento</h2>
            <button type="button" onClick={() => setItems((a) => [...a, makeItem()])} className="btn-ghost h-8 text-xs">
              <Plus className="size-3.5" /> Adicionar item
            </button>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-2 font-medium w-[50%]">Descrição</th>
                  <th className="py-2 pr-2 font-medium w-24">Qtd.</th>
                  <th className="py-2 pr-2 font-medium w-36">Valor unitário (R$)</th>
                  <th className="py-2 pr-2 font-medium text-right w-32">Subtotal</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const q = parseFloat(it.quantity.replace(",", ".")) || 0;
                  const line = Math.round(q * parseMoneyToCents(it.unit));
                  return (
                    <tr key={it.key} className="border-b border-border/40">
                      <td className="py-2 pr-2">
                        <input value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} className="input h-9 w-full" placeholder="Ex.: Higienização de split 12.000 BTUs" maxLength={200} />
                      </td>
                      <td className="py-2 pr-2">
                        <input value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} className="input h-9 w-full text-right" inputMode="decimal" />
                      </td>
                      <td className="py-2 pr-2">
                        <input value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                          onBlur={(e) => updateItem(it.key, { unit: centsToInput(parseMoneyToCents(e.target.value)) })}
                          className="input h-9 w-full text-right" inputMode="decimal" />
                      </td>
                      <td className="py-2 pr-2 text-right font-medium tabular-nums">{formatCents(line)}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => removeItem(it.key)} className="btn-ghost h-8 !px-2 text-muted-foreground hover:text-destructive" title="Remover">
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-3 text-right text-sm uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="py-3 text-right font-display text-lg font-semibold tabular-nums">{formatCents(totalCents)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {items.map((it, idx) => {
              const q = parseFloat(it.quantity.replace(",", ".")) || 0;
              const line = Math.round(q * parseMoneyToCents(it.unit));
              return (
                <div key={it.key} className="rounded-lg border border-border/60 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Item {idx + 1}</p>
                    <button type="button" onClick={() => removeItem(it.key)} className="btn-ghost h-8 !px-2 text-muted-foreground hover:text-destructive" title="Remover">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Descrição</label>
                    <input value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} className="input mt-1 h-11 w-full" placeholder="Ex.: Higienização de split 12.000 BTUs" maxLength={200} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Qtd.</label>
                      <input value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} className="input mt-1 h-11 w-full text-right" inputMode="decimal" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Unitário (R$)</label>
                      <input value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                        onBlur={(e) => updateItem(it.key, { unit: centsToInput(parseMoneyToCents(e.target.value)) })}
                        className="input mt-1 h-11 w-full text-right" inputMode="decimal" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 pt-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{formatCents(line)}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-3">
              <span className="text-sm uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="font-display text-xl font-semibold tabular-nums">{formatCents(totalCents)}</span>
            </div>
          </div>
        </section>

        <section className="surface-card p-4 md:p-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Data de validade</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input mt-1 w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input mt-1 w-full resize-y" maxLength={2000} placeholder="Condições de pagamento, garantia, prazo de execução..." />
          </div>
        </section>

        <div className="md:hidden pt-2 pb-6">
          <button onClick={save} disabled={saving} className="btn-primary w-full h-14 text-base">
            {saving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            Salvar orçamento
          </button>
        </div>
      </main>
    </div>
  );
}