import type {
  PaymentProvider,
  PaymentProviderId,
  CreateIntentInput,
  CreateIntentResult,
  VerifyIntentResult,
} from "./types";

// ---------------------------------------------------------------------------
// Registry de provedores. Nenhum está ativo — só o "manual" resolve promises
// para permitir o fluxo de "marcar como pago" pelo próprio estabelecimento.
// Provedores reais devem ser plugados neste arquivo (um por bloco) e habilitados
// no seletor da UI (PROVIDER_CATALOG).
// ---------------------------------------------------------------------------

const notImplemented = (label: string) => async (): Promise<never> => {
  throw new Error(`${label}: integração ainda não implementada.`);
};

const manualProvider: PaymentProvider = {
  id: "manual",
  label: "Confirmação manual",
  supportsRefund: false,
  isConfigured: () => true,
  async createIntent(_input: CreateIntentInput): Promise<CreateIntentResult> {
    // O manual não cria checkout externo; o dono confirma o pagamento no painel.
    return { providerIntentId: null, checkoutUrl: null };
  },
  async verifyIntent(_id: string): Promise<VerifyIntentResult> {
    return { status: "pending" };
  },
};

const stubProvider = (id: PaymentProviderId, label: string): PaymentProvider => ({
  id,
  label,
  supportsRefund: false,
  isConfigured: () => false,
  createIntent: notImplemented(label),
  verifyIntent: notImplemented(label),
});

const REGISTRY: Record<PaymentProviderId, PaymentProvider> = {
  manual: manualProvider,
  stripe: stubProvider("stripe", "Stripe"),
  mercado_pago: stubProvider("mercado_pago", "Mercado Pago"),
  asaas: stubProvider("asaas", "Asaas"),
  pagseguro: stubProvider("pagseguro", "PagSeguro"),
};

export function getPaymentProvider(id: PaymentProviderId | null | undefined): PaymentProvider {
  if (!id) return manualProvider;
  return REGISTRY[id] ?? manualProvider;
}

// Catálogo exibido nas configurações. `available: false` mostra o item como
// "em breve" na UI, mantendo a arquitetura pronta para futura ativação.
export type ProviderCatalogEntry = {
  id: PaymentProviderId;
  label: string;
  description: string;
  available: boolean;
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "manual",
    label: "Confirmação manual",
    description: "Cliente combina pagamento fora do sistema; você confirma no painel.",
    available: true,
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Cartão internacional e recorrência. Em breve.",
    available: false,
  },
  {
    id: "mercado_pago",
    label: "Mercado Pago",
    description: "Pix, boleto e cartão. Em breve.",
    available: false,
  },
  {
    id: "asaas",
    label: "Asaas",
    description: "Pix, boleto e cartão com split. Em breve.",
    available: false,
  },
  {
    id: "pagseguro",
    label: "PagSeguro",
    description: "Pix, boleto e cartão. Em breve.",
    available: false,
  },
];