import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  buildTemplateVars,
  buildWhatsappUrl,
  MESSAGE_KIND_LABEL,
  openWhatsapp,
  pickTemplate,
  renderTemplate,
  type MessageKind,
  type TemplateContext,
} from "@/lib/whatsapp";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

type Booking = {
  id: string;
  status: string;
  start_at: string;
  customer_name: string;
  customer_phone: string | null;
  manage_token?: string | null;
  service?: { name: string; duration_minutes: number; price_cents?: number | null } | null;
  professional?: { name: string } | null;
};

type Company = { id: string; name: string; timezone?: string | null; address?: string | null; slug?: string | null };

function useTemplates(companyId: string | undefined | null) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["message-templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("kind, body, enabled")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data as Array<{ kind: MessageKind; body: string; enabled: boolean }>;
    },
    staleTime: 60_000,
  });
}

function availableKinds(booking: Booking): MessageKind[] {
  const startsInMs = new Date(booking.start_at).getTime() - Date.now();
  const kinds: MessageKind[] = [];
  if (booking.status === "cancelled") {
    kinds.push("cancellation");
    return kinds;
  }
  kinds.push("confirmation");
  kinds.push("reschedule");
  // Só mostrar lembretes se o horário ainda não passou
  if (startsInMs > 0) {
    kinds.push("reminder_24h");
    kinds.push("reminder_1h");
  }
  kinds.push("cancellation");
  return kinds;
}

function contextFor(company: Company, booking: Booking): TemplateContext | null {
  if (!booking.service || !booking.professional) return null;
  return {
    company,
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      customer_name: booking.customer_name,
      manage_token: booking.manage_token ?? null,
    },
    service: booking.service,
    professional: booking.professional,
  };
}

/** Botão único que abre popover com lista de mensagens e prévia editável. */
export function WhatsappMenu({
  booking,
  company,
  size = "sm",
  markReminder,
}: {
  booking: Booking;
  company: Company;
  size?: "sm" | "xs";
  markReminder?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MessageKind | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const tplQ = useTemplates(company.id);

  const kinds = useMemo(() => availableKinds(booking), [booking]);
  const ctx = contextFor(company, booking);

  function pick(k: MessageKind) {
    if (!ctx) return;
    const t = pickTemplate(tplQ.data, k);
    const text = renderTemplate(t.body, buildTemplateVars(ctx));
    setKind(k);
    setDraft(text);
  }

  async function markReminderSent(k: MessageKind) {
    if (!markReminder) return;
    if (k !== "reminder_24h" && k !== "reminder_1h") return;
    const now = new Date().toISOString();
    const patch = k === "reminder_24h" ? { reminder_24h_sent_at: now } : { reminder_1h_sent_at: now };
    const { error } = await supabase.from("bookings").update(patch).eq("id", booking.id);
    if (error) toast.error("Não consegui marcar o lembrete como enviado");
  }

  async function send() {
    if (!kind) return;
    setSending(true);
    try {
      openWhatsapp(booking.customer_phone, draft);
      await markReminderSent(kind);
      toast.success("WhatsApp aberto — confirme o envio no app");
      setOpen(false);
      setKind(null);
    } finally {
      setSending(false);
    }
  }

  const hasPhone = !!(booking.customer_phone && booking.customer_phone.replace(/\D/g, ""));
  const btnClass = size === "xs" ? "btn-ghost h-8 !px-2 text-xs" : "btn-ghost h-9 !px-3 text-xs";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setKind(null); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={btnClass}
          title={hasPhone ? "Enviar WhatsApp" : "Sem telefone cadastrado"}
        >
          <MessageCircle className="size-3.5" style={{ color: "#25D366" }} /> WhatsApp
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        {!kind ? (
          <div className="p-2">
            <p className="px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">Enviar mensagem</p>
            {tplQ.isLoading ? (
              <div className="p-3 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="flex flex-col">
                {kinds.map((k) => {
                  const t = pickTemplate(tplQ.data, k);
                  return (
                    <button
                      key={k}
                      onClick={() => pick(k)}
                      className="text-left px-2 py-2 rounded-md hover:bg-accent text-sm flex items-center justify-between gap-2"
                    >
                      <span>{MESSAGE_KIND_LABEL[k]}</span>
                      {!t.enabled && <span className="text-[10px] uppercase text-muted-foreground">desligado</span>}
                    </button>
                  );
                })}
                {!hasPhone && (
                  <p className="mt-1 px-2 py-1.5 text-xs text-muted-foreground">Cliente sem telefone — só copie a mensagem.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{MESSAGE_KIND_LABEL[kind]}</p>
              <button onClick={() => setKind(null)} className="text-xs text-muted-foreground hover:text-foreground">← Trocar</button>
            </div>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={9} className="text-sm" />
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={async () => { await navigator.clipboard.writeText(draft); toast.success("Mensagem copiada"); }}
                className="btn-ghost h-8 !px-2 text-xs"
              >
                Copiar texto
              </button>
              <a
                href={buildWhatsappUrl(booking.customer_phone, draft)}
                target="_blank"
                rel="noreferrer"
                onClick={() => { void markReminderSent(kind); setOpen(false); setKind(null); }}
                className="btn-primary h-8 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Send className="size-3.5" /> Abrir WhatsApp
              </a>
              <button
                onClick={send}
                disabled={sending}
                className="hidden"
                aria-hidden
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Isso abre uma conversa no WhatsApp com a mensagem já preenchida — o envio é feito por você no aparelho. Templates podem ser editados em Configurações → Mensagens.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}