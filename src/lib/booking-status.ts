// Status de agendamento genéricos, válidos para qualquer nicho de serviço
// (salões, clínicas, assistência técnica, manutenção etc.).

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "awaiting_parts"
  | "completed"
  | "cancelled";

export const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "awaiting_parts",
  "completed",
  "cancelled",
];

/** Rótulo no singular (badges, detalhes). */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  awaiting_parts: "Aguardando material/peça",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/** Rótulo no plural (abas / filtros). */
export const BOOKING_STATUS_LABEL_PLURAL: Record<BookingStatus, string> = {
  pending: "Pendentes",
  confirmed: "Confirmados",
  in_progress: "Em andamento",
  awaiting_parts: "Aguardando material",
  completed: "Concluídos",
  cancelled: "Cancelados",
};

/** Classes de cor por status (azul, amarelo, roxo, verde, vermelho). */
export const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
  in_progress: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  awaiting_parts: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
};

/** Cor sólida (barras/cards do calendário). */
export const BOOKING_STATUS_DOT: Record<BookingStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-blue-500",
  in_progress: "bg-yellow-500",
  awaiting_parts: "bg-purple-500",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-500",
};

export function bookingStatusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return BOOKING_STATUS_LABEL[s as BookingStatus] ?? s;
}

export function bookingStatusStyle(s: string | null | undefined): string {
  return BOOKING_STATUS_STYLE[(s ?? "") as BookingStatus] ?? "bg-muted text-muted-foreground border-border";
}

/** Próximos status sugeridos a partir do status atual (fluxo operacional). */
export const BOOKING_STATUS_NEXT: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "awaiting_parts", "completed", "cancelled"],
  in_progress: ["awaiting_parts", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};
