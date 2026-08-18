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
  const nomeCliente = input.customerName?.trim() || "cliente";
  const nomeEmpresa = input.companyName?.trim() || "nossa empresa";
  const valorTotal = formatCents(input.totalCents);
  const dataValidade = input.validUntil
    ? new Date(input.validUntil).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "não informada";
  const linkPublico = input.publicUrl;

  return `Olá, ${nomeCliente}!

Seu orçamento da ${nomeEmpresa} já está pronto e disponível para conferência.

Valor total: ${valorTotal} Válido até: ${dataValidade}

Acesse o link abaixo para ver todos os detalhes técnicos e aprovar o serviço: ${linkPublico}

Qualquer dúvida, estou à disposição!`;
}