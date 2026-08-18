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

  const lines: string[] = [];
  lines.push(`Olá ${customer}! 👋`);
  lines.push("");
  lines.push(`Seu orçamento na *${company}* já está pronto e disponível para conferência.`);
  lines.push("");
  lines.push(`💰 *Valor total:* ${total}`);
  if (validDate) lines.push(`📅 *Válido até:* ${validDate}`);
  lines.push("");
  lines.push("👇 Toque no link abaixo para ver todos os detalhes e aprovar:");
  lines.push(input.publicUrl);
  lines.push("");
  lines.push("Qualquer dúvida, é só me chamar por aqui. Estou à disposição! 🙌");
  return lines.join("\n");
}