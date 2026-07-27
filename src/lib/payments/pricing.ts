import type { PaymentSettings } from "./types";

// Retorna o valor a cobrar (em centavos) para um serviço, dado o modo configurado.
// Retorna 0 quando pagamento antecipado não se aplica.
export function computeChargeAmount(opts: {
  settings: PaymentSettings;
  servicePriceCents: number;
  serviceRequiresPayment: boolean;
}): number {
  const { settings, servicePriceCents, serviceRequiresPayment } = opts;
  if (!settings.enabled || settings.mode === "none") return 0;
  // Se a empresa marcou "somente serviços selecionados" e este serviço não exige, não cobra.
  if (settings.require_per_service && !serviceRequiresPayment) return 0;

  switch (settings.mode) {
    case "fixed":
      return Math.max(0, Math.min(settings.fixed_amount_cents, servicePriceCents || settings.fixed_amount_cents));
    case "percentage": {
      const pct = Math.max(0, Math.min(100, Number(settings.percentage) || 0));
      return Math.round((servicePriceCents * pct) / 100);
    }
    case "full":
      return servicePriceCents;
    default:
      return 0;
  }
}

export function isChargeRequired(opts: {
  settings: PaymentSettings;
  servicePriceCents: number;
  serviceRequiresPayment: boolean;
}): boolean {
  return computeChargeAmount(opts) > 0;
}

export function formatMoney(cents: number, currency = "BRL"): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}