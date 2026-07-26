import { formatInTZ } from "@/lib/timezone";

export type MessageKind =
  | "confirmation"
  | "reschedule"
  | "cancellation"
  | "reminder_24h"
  | "reminder_1h";

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  confirmation: "Confirmação de agendamento",
  reschedule: "Remarcação",
  cancellation: "Cancelamento",
  reminder_24h: "Lembrete — 24 horas antes",
  reminder_1h: "Lembrete — 1 hora antes",
};

export const MESSAGE_KIND_HINT: Record<MessageKind, string> = {
  confirmation: "Enviada quando você confirma um agendamento.",
  reschedule: "Enviada quando um horário é remarcado.",
  cancellation: "Enviada quando o agendamento é cancelado.",
  reminder_24h: "Lembrete disparado no dia anterior ao atendimento.",
  reminder_1h: "Lembrete disparado ~1 hora antes do atendimento.",
};

export const MESSAGE_VARIABLES: Array<{ key: string; label: string }> = [
  { key: "cliente", label: "Nome do cliente" },
  { key: "empresa", label: "Nome da empresa" },
  { key: "servico", label: "Serviço agendado" },
  { key: "profissional", label: "Profissional" },
  { key: "data", label: "Data (ex.: seg, 12 ago)" },
  { key: "hora", label: "Horário (ex.: 14:30)" },
  { key: "duracao", label: "Duração em minutos" },
  { key: "preco", label: "Preço formatado" },
  { key: "endereco", label: "Endereço da empresa" },
  { key: "link_gerenciar", label: "Link para o cliente gerenciar" },
];

export const DEFAULT_TEMPLATES: Record<MessageKind, string> = {
  confirmation:
    "Olá {cliente}! ✅\n\nSeu agendamento em *{empresa}* foi confirmado:\n\n• Serviço: {servico}\n• Profissional: {profissional}\n• Data: {data} às {hora}\n• Duração: {duracao} min\n\nQualquer alteração é só falar comigo por aqui.\nGerenciar ou cancelar: {link_gerenciar}",
  reschedule:
    "Olá {cliente}! 🔁\n\nSeu agendamento em *{empresa}* foi remarcado.\n\nNovo horário:\n• {data} às {hora}\n• {servico} com {profissional}\n\nGerenciar: {link_gerenciar}",
  cancellation:
    "Olá {cliente}. ❌\n\nSeu agendamento em *{empresa}* para {data} às {hora} foi cancelado.\n\nSe quiser, é só me chamar por aqui para reagendarmos.",
  reminder_24h:
    "Oi {cliente}! 👋\n\nLembrete do seu horário amanhã em *{empresa}*:\n\n• {servico} com {profissional}\n• {data} às {hora}\n\nAté lá! Precisa remarcar? {link_gerenciar}",
  reminder_1h:
    "Oi {cliente}! ⏰\n\nSeu horário em *{empresa}* é daqui a pouco:\n\n• {servico} com {profissional}\n• Hoje às {hora}\n\nTe espero!",
};

export type TemplateContext = {
  company: { name: string; timezone?: string | null; address?: string | null; slug?: string | null };
  booking: {
    id: string;
    start_at: string;
    customer_name: string;
    manage_token?: string | null;
  };
  service: { name: string; duration_minutes: number; price_cents?: number | null };
  professional: { name: string };
};

function manageLink(token?: string | null): string {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/manage/${token}`;
}

export function buildTemplateVars(ctx: TemplateContext): Record<string, string> {
  const tz = ctx.company.timezone || "America/Sao_Paulo";
  const data = formatInTZ(ctx.booking.start_at, tz, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const hora = formatInTZ(ctx.booking.start_at, tz, { hour: "2-digit", minute: "2-digit" });
  const preco =
    ctx.service.price_cents != null
      ? (ctx.service.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "";
  return {
    cliente: ctx.booking.customer_name || "",
    empresa: ctx.company.name || "",
    servico: ctx.service.name || "",
    profissional: ctx.professional.name || "",
    data,
    hora,
    duracao: String(ctx.service.duration_minutes ?? ""),
    preco,
    endereco: ctx.company.address || "",
    link_gerenciar: manageLink(ctx.booking.manage_token),
  };
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_m, key: string) => vars[key] ?? "");
}

/** Digits only, drop leading zeros. Adds "55" (BR) if number has 10-11 digits and no country code. */
export function normalizePhone(input: string | null | undefined): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  // Already has a country code (12+ digits) — leave as is.
  if (digits.length >= 12) return digits;
  // Local BR number (DDD + number) — prefix 55.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsappUrl(phone: string | null | undefined, message: string): string {
  const num = normalizePhone(phone);
  const text = encodeURIComponent(message);
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function openWhatsapp(phone: string | null | undefined, message: string) {
  const url = buildWhatsappUrl(phone, message);
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}

/** Escolhe o template daquele tipo entre a lista carregada do banco, ou usa o padrão. */
export function pickTemplate(
  templates: Array<{ kind: MessageKind; body: string; enabled: boolean }> | null | undefined,
  kind: MessageKind
): { body: string; enabled: boolean } {
  const t = templates?.find((x) => x.kind === kind);
  if (t) return { body: t.body, enabled: t.enabled };
  return { body: DEFAULT_TEMPLATES[kind], enabled: true };
}