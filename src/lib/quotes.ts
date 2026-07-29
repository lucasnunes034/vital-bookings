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