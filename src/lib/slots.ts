import { getZonedParts, zonedWallToUTC } from "./timezone";

export type AvailWindow = { start_time: string; end_time: string };
export type BusyRange = { start: Date; end: Date };

/** Gera slots "HH:mm" (no fuso `timeZone`) disponíveis para a data `date`. */
export function computeSlots({
  date,
  timeZone,
  duration,
  avail,
  breaks,
  busy,
  stepMinutes = 15,
  now = new Date(),
}: {
  date: Date;
  timeZone: string;
  duration: number;
  avail: AvailWindow[];
  breaks: AvailWindow[];
  busy: BusyRange[];
  stepMinutes?: number;
  now?: Date;
}): string[] {
  const out: string[] = [];
  const p = getZonedParts(date, timeZone);
  for (const win of avail) {
    const [sh, sm] = win.start_time.split(":").map(Number);
    const [eh, em] = win.end_time.split(":").map(Number);
    const winStart = zonedWallToUTC(p.year, p.month, p.day, sh, sm, timeZone);
    const winEnd = zonedWallToUTC(p.year, p.month, p.day, eh, em, timeZone);
    for (let t = winStart.getTime(); t + duration * 60000 <= winEnd.getTime(); t += stepMinutes * 60000) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + duration * 60000);
      if (slotStart < now) continue;
      const hitsBreak = breaks.some((b) => {
        const [bh, bm] = b.start_time.split(":").map(Number);
        const [beh, bem] = b.end_time.split(":").map(Number);
        const bs = zonedWallToUTC(p.year, p.month, p.day, bh, bm, timeZone);
        const be = zonedWallToUTC(p.year, p.month, p.day, beh, bem, timeZone);
        return slotStart < be && slotEnd > bs;
      });
      if (hitsBreak) continue;
      const hitsBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start);
      if (hitsBusy) continue;
      const zp = getZonedParts(slotStart, timeZone);
      out.push(`${String(zp.hour).padStart(2, "0")}:${String(zp.minute).padStart(2, "0")}`);
    }
  }
  return out;
}