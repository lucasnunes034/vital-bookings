export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  accepted: "Aceito",
  rejected: "Recusado",
  expired: "Expirado",
};

export function formatCents(cents: number | null | undefined): string {
  const v = ((cents ?? 0) / 100);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseMoneyToCents(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function quoteNumberLabel(n: number | null | undefined): string {
  const num = n ?? 0;
  return `#${String(num).padStart(4, "0")}`;
}

export type QuoteWhatsAppInput = {
  customerName: string;
  companyName: string | null | undefined;
  totalCents: number | null | undefined;
  validUntil: string | null | undefined; // ISO date or null
  publicUrl: string;
};

/** Monta a mensagem de WhatsApp profissional para envio do orçamento. */
export function buildQuoteWhatsAppMessage(input: QuoteWhatsAppInput): string {
  const customer = input.customerName?.trim() || "cliente";
  const company = (input.companyName?.trim() || "nossa empresa");
  const total = formatCents(input.totalCents);
  const validDate = input.validUntil
    ? new Date(input.validUntil).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  // Template literal com quebras de linha reais (\n) — encodeURIComponent, em
  // buildWhatsappUrl, converte cada \n em %0A e cada emoji/acentuação em seus
  // bytes UTF-8 percentuais, evitando o caractere `` de codificação quebrada.
  return `Olá ${customer}! 👋

Seu orçamento na *${company}* já está pronto e disponível para conferência.

💰 *Valor total:* ${total}${validDate ? `\n📅 *Válido até:* ${validDate}` : ""}

👇 Toque no link abaixo para ver todos os detalhes e aprovar:
${input.publicUrl}

Qualquer dúvida, é só me chamar por aqui. Estou à disposição! 🙌`;
}