// Formas de pagamento presencial aceitas pela empresa.
// A cobrança acontece fora do sistema; usamos apenas para o cliente informar
// como pretende pagar e o painel exibir essa preferência.

export type PaymentMethodKind = "cash" | "pix" | "debit_card" | "credit_card";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodKind, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
};

export const PAYMENT_METHOD_ORDER: PaymentMethodKind[] = [
  "cash",
  "pix",
  "debit_card",
  "credit_card",
];

export function formatPaymentMethod(kind: string | null | undefined): string | null {
  if (!kind) return null;
  return PAYMENT_METHOD_LABEL[kind as PaymentMethodKind] ?? kind;
}

export function sortPaymentMethods(list: string[] | null | undefined): PaymentMethodKind[] {
  const set = new Set((list ?? []).filter(Boolean));
  return PAYMENT_METHOD_ORDER.filter((m) => set.has(m));
}