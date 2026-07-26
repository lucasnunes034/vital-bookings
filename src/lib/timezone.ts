// Utilitários de fuso horário para agendamentos.
// O banco armazena start_at/end_at em UTC (timestamptz). A UI (pública e admin)
// interpreta e exibe horários no fuso da empresa (companies.timezone).
// Nenhuma dependência extra: usamos Intl.DateTimeFormat.

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFmt(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  // Diferença entre o "wall clock" que o fuso mostra e UTC, para o instante dado.
  const parts = partsFmt(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - instant.getTime();
}

/**
 * Converte um "wall clock" (Y-M-D H:M no fuso `timeZone`) para um instante UTC.
 * Ex.: zonedWallToUTC(2026, 7, 26, 14, 30, "America/Sao_Paulo") → Date UTC 17:30.
 */
export function zonedWallToUTC(
  y: number, mo: number, d: number, h: number, mi: number, timeZone: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // O offset pode variar em dias de DST; iteramos duas vezes para convergir.
  let offset = tzOffsetMs(new Date(guess), timeZone);
  let result = new Date(guess - offset);
  const offset2 = tzOffsetMs(result, timeZone);
  if (offset2 !== offset) result = new Date(guess - offset2);
  return result;
}

/** Retorna Y/M/D/H/M/dow do instante `d` no fuso `timeZone` (dow: 0=domingo..6=sábado). */
export function getZonedParts(d: Date, timeZone: string) {
  const parts = partsFmt(timeZone).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    dow: dow < 0 ? 0 : dow,
  };
}

/** Início/fim do dia local `d` (interpretado no fuso) em instantes UTC. */
export function zonedDayRangeUTC(d: Date, timeZone: string) {
  const p = getZonedParts(d, timeZone);
  const start = zonedWallToUTC(p.year, p.month, p.day, 0, 0, timeZone);
  const end = new Date(zonedWallToUTC(p.year, p.month, p.day + 1, 0, 0, timeZone).getTime() - 1);
  return { start, end };
}

/** Data ISO (YYYY-MM-DD) no fuso da empresa. */
export function toZonedISODate(d: Date, timeZone: string) {
  const p = getZonedParts(d, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Dia da semana (0-6) no fuso da empresa. */
export function zonedDayOfWeek(d: Date, timeZone: string) {
  return getZonedParts(d, timeZone).dow;
}

/** Formata um instante no fuso `timeZone` com opções pt-BR. */
export function formatInTZ(
  d: Date | string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", { timeZone, ...opts }).format(date);
}