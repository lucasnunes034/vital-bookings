export const SUPPORT_WHATSAPP = "5511999999999";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled";

export type CompanySubscription = {
  subscription_status: string | null;
  subscription_ends_at: string | null;
};

/** Retorna true quando o acesso ao painel deve ser bloqueado. */
export function isSubscriptionBlocked(c: CompanySubscription | null | undefined): boolean {
  if (!c) return false;
  const status = (c.subscription_status ?? "trial") as SubscriptionStatus;
  if (status === "past_due" || status === "canceled") return true;
  if (status === "active") return false;
  if (c.subscription_ends_at && new Date(c.subscription_ends_at).getTime() < Date.now()) return true;
  return false;
}

export function subscriptionReason(c: CompanySubscription | null | undefined): string {
  const status = (c?.subscription_status ?? "trial") as SubscriptionStatus;
  if (status === "past_due") return "Identificamos um pagamento pendente na sua assinatura.";
  if (status === "canceled") return "Sua assinatura foi cancelada.";
  return "Seu período de teste gratuito chegou ao fim.";
}