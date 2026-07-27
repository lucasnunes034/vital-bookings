// Camada de abstração de pagamentos.
// Nenhum gateway está ativo ainda — este arquivo define os tipos e o contrato
// que qualquer provedor futuro (Stripe, Mercado Pago, Asaas, PagSeguro, etc.)
// deverá implementar.

export type PaymentMode = "none" | "fixed" | "percentage" | "full";

export type PaymentIntentStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "refunded"
  | "failed";

export type PaymentProviderId =
  | "manual"
  | "stripe"
  | "mercado_pago"
  | "asaas"
  | "pagseguro";

export type PaymentSettings = {
  company_id: string;
  enabled: boolean;
  mode: PaymentMode;
  fixed_amount_cents: number;
  percentage: number;
  currency: string;
  provider: PaymentProviderId | null;
  provider_config: Record<string, unknown>;
  expires_after_minutes: number;
  require_per_service: boolean;
  cancellation_policy: string | null;
  refund_policy: string | null;
};

export type BookingForCharge = {
  id: string;
  company_id: string;
  service_price_cents: number;
  service_requires_payment: boolean;
  customer_name: string;
  customer_email: string | null;
  manage_token: string;
};

export type CreateIntentInput = {
  booking: BookingForCharge;
  settings: PaymentSettings;
  amountCents: number;
  returnUrl?: string;
};

export type CreateIntentResult = {
  providerIntentId: string | null;
  checkoutUrl: string | null;
  rawPayload?: Record<string, unknown>;
};

export type VerifyIntentResult = {
  status: PaymentIntentStatus;
  paidAt?: string;
  failureReason?: string;
  rawPayload?: Record<string, unknown>;
};

// Contrato que todo provedor deve implementar.
// Cada método é opcional em runtime: quando o provedor real for adicionado,
// ele preenche as capacidades que suporta.
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly label: string;
  readonly supportsRefund: boolean;
  readonly isConfigured: (settings: PaymentSettings) => boolean;

  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  verifyIntent(providerIntentId: string): Promise<VerifyIntentResult>;
  cancelIntent?(providerIntentId: string): Promise<void>;
  refundIntent?(providerIntentId: string, amountCents?: number): Promise<void>;
}