// Mapeia erros do Supabase/Postgres em mensagens amigáveis e específicas para
// o fluxo de agendamentos (criar, confirmar, cancelar, remarcar).
// Sempre loga o erro original no console para depuração.

export type BookingErrorContext =
  | "create"
  | "reschedule"
  | "cancel"
  | "confirm"
  | "review"
  | "generic";

export type MappedBookingError = {
  message: string;
  description?: string;
  kind:
    | "conflict"
    | "past"
    | "invalid_time"
    | "wrong_duration"
    | "invalid_data"
    | "not_found"
    | "not_allowed"
    | "expired"
    | "payment_pending"
    | "network"
    | "rate_limited"
    | "server"
    | "unknown";
};

function pick(err: any): { code: string; message: string; details: string; hint: string } {
  return {
    code: String(err?.code ?? err?.details?.code ?? err?.status ?? ""),
    message: String(err?.message ?? ""),
    details: String(err?.details ?? ""),
    hint: String(err?.hint ?? ""),
  };
}

export function mapBookingError(
  err: unknown,
  ctx: BookingErrorContext = "generic",
): MappedBookingError {
  // Log estruturado sempre — para o console do navegador ajudar na depuração.
  // eslint-disable-next-line no-console
  console.error(`[booking:${ctx}]`, err);

  const { code, message, details, hint } = pick(err);
  const all = `${code} ${message} ${details} ${hint}`.toLowerCase();

  // Falha de rede (fetch abortado, offline, DNS, etc.)
  if (
    err instanceof TypeError ||
    all.includes("failed to fetch") ||
    all.includes("networkerror") ||
    all.includes("load failed")
  ) {
    return {
      kind: "network",
      message: "Falha na comunicação com o servidor.",
      description: "Verifique sua conexão e tente novamente em instantes.",
    };
  }

  // Conflito de horário — exclusion constraint
  if (
    code === "23P01" ||
    all.includes("bookings_no_overlap") ||
    all.includes("exclusion")
  ) {
    return {
      kind: "conflict",
      message: "Este horário já foi reservado por outro cliente.",
      description: "Escolha outro horário disponível.",
    };
  }

  // Mensagens específicas vindas de RPCs SECURITY DEFINER
  if (all.includes("not_found")) {
    return { kind: "not_found", message: "Agendamento não encontrado ou link expirado." };
  }
  if (all.includes("not_cancellable")) {
    return { kind: "not_allowed", message: "Este agendamento não pode mais ser cancelado." };
  }
  if (all.includes("not_reschedulable")) {
    return { kind: "not_allowed", message: "Este agendamento não pode mais ser remarcado." };
  }
  if (all.includes("past_booking")) {
    return { kind: "past", message: "Agendamentos passados não podem ser alterados." };
  }
  if (all.includes("invalid_new_time")) {
    return { kind: "invalid_time", message: "O novo horário precisa estar no futuro." };
  }
  if (all.includes("wrong_duration")) {
    return {
      kind: "wrong_duration",
      message: "A duração do novo horário está diferente do serviço.",
    };
  }
  if (all.includes("expired") || all.includes("expirou")) {
    return { kind: "expired", message: "O horário expirou. Selecione outro e tente novamente." };
  }
  if (all.includes("payment_pending") || all.includes("payment_required")) {
    return {
      kind: "payment_pending",
      message: "Pagamento pendente para este agendamento.",
      description: "Conclua o pagamento para confirmar sua reserva.",
    };
  }

  // RLS bloqueou o insert — a policy exige start_at futuro, duração correta,
  // serviço/profissional ativos e limites de texto. Damos a explicação mais
  // provável em vez de mostrar "verifique os dados".
  if (code === "42501" || all.includes("row-level security") || all.includes("violates row-level")) {
    if (ctx === "create") {
      return {
        kind: "invalid_data",
        message: "Não foi possível registrar o agendamento.",
        description:
          "O horário pode ter acabado de passar, o serviço/profissional pode estar inativo, ou algum dado do formulário é inválido. Selecione outro horário e revise nome, telefone e e-mail.",
      };
    }
    return {
      kind: "not_allowed",
      message: "Você não tem permissão para essa ação.",
    };
  }

  // CHECK constraint em campos de texto
  if (code === "23514") {
    return {
      kind: "invalid_data",
      message: "Dados obrigatórios inválidos.",
      description: "Revise nome, telefone, e-mail e observações antes de tentar novamente.",
    };
  }

  // NOT NULL / foreign key
  if (code === "23502") {
    return { kind: "invalid_data", message: "Preencha todos os campos obrigatórios." };
  }
  if (code === "23503") {
    return {
      kind: "invalid_data",
      message: "Serviço ou profissional não está mais disponível.",
      description: "Volte e escolha novamente.",
    };
  }

  // Rate limit (edge/gateway)
  if (code === "429" || all.includes("rate limit") || all.includes("too many")) {
    return {
      kind: "rate_limited",
      message: "Muitas tentativas em pouco tempo.",
      description: "Aguarde alguns segundos e tente novamente.",
    };
  }

  // Erros 5xx / servidor
  if (
    code.startsWith("5") ||
    all.includes("internal server") ||
    all.includes("timeout") ||
    all.includes("gateway")
  ) {
    return {
      kind: "server",
      message: "Erro temporário no servidor.",
      description: "Tente novamente em alguns instantes.",
    };
  }

  // Fallback: usa a mensagem crua se existir, senão texto genérico.
  return {
    kind: "unknown",
    message: message || "Não foi possível concluir a operação.",
    description: details || hint || undefined,
  };
}

/** Atalho: mostra o erro mapeado como toast e retorna o mapeamento. */
export function toastBookingError(
  toastFn: (msg: string, opts?: { description?: string }) => void,
  err: unknown,
  ctx: BookingErrorContext = "generic",
): MappedBookingError {
  const m = mapBookingError(err, ctx);
  toastFn(m.message, m.description ? { description: m.description } : undefined);
  return m;
}