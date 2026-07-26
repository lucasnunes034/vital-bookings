import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, CalendarDays, CalendarRange,
  Plus, X, User, Phone, Mail, StickyNote,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  formatInTZ, getZonedParts, toZonedISODate, zonedDayOfWeek, zonedWallToUTC,
} from "@/lib/timezone";

type ViewMode = "day" | "week";

const searchSchema = z.object({
  date: z.string().optional(),
  view: z.enum(["day", "week"]).optional(),
  pro: z.string().optional(),
  svc: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendário · Slotly" },
      { name: "description", content: "Visualize e organize sua agenda com arrastar e soltar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  component: CalendarPage,
});

const SLOT_MIN = 30; // grid granularity
const ROW_PX = 28;   // px per 30 min row

function CalendarPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();

  const companyQ = useQuery({
    queryKey: ["my-company-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, timezone")
        .order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const tz = companyQ.data?.timezone || "America/Sao_Paulo";

  const prosQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["cal-pros", companyQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, status")
        .eq("company_id", companyQ.data!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const svcsQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["cal-svcs", companyQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, status")
        .eq("company_id", companyQ.data!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const view: ViewMode = search.view ?? "week";
  const anchor = useMemo(() => {
    if (search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date)) {
      const [y, m, d] = search.date.split("-").map(Number);
      return zonedWallToUTC(y, m, d, 12, 0, tz);
    }
    return new Date();
  }, [search.date, tz]);

  const proId = search.pro ?? "";
  const svcId = search.svc ?? "";

  // Default professional selection once pros load
  useEffect(() => {
    if (!proId && prosQ.data && prosQ.data.length > 0) {
      navigate({
        to: "/calendar",
        search: (prev) => ({ ...prev, pro: prosQ.data![0].id }),
        replace: true,
      });
    }
  }, [prosQ.data, proId, navigate]);

  const days = useMemo(() => {
    const list: Date[] = [];
    const p = getZonedParts(anchor, tz);
    if (view === "day") {
      list.push(zonedWallToUTC(p.year, p.month, p.day, 12, 0, tz));
    } else {
      // week starting on Sunday to match zonedDayOfWeek (0=Sun)
      const offset = -p.dow;
      for (let i = 0; i < 7; i++) {
        list.push(zonedWallToUTC(p.year, p.month, p.day + offset + i, 12, 0, tz));
      }
    }
    return list;
  }, [anchor, view, tz]);

  const rangeStart = useMemo(() => {
    const p = getZonedParts(days[0], tz);
    return zonedWallToUTC(p.year, p.month, p.day, 0, 0, tz);
  }, [days, tz]);
  const rangeEnd = useMemo(() => {
    const p = getZonedParts(days[days.length - 1], tz);
    return zonedWallToUTC(p.year, p.month, p.day + 1, 0, 0, tz);
  }, [days, tz]);

  // Availability + breaks for selected professional
  const availQ = useQuery({
    enabled: !!proId,
    queryKey: ["cal-avail", proId],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("professional_availability").select("day_of_week, start_time, end_time").eq("professional_id", proId),
        supabase.from("professional_breaks").select("day_of_week, start_time, end_time").eq("professional_id", proId),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      return { avail: a.data ?? [], breaks: b.data ?? [] };
    },
  });

  // Bookings in range
  const bookingsQ = useQuery({
    enabled: !!companyQ.data?.id,
    queryKey: ["cal-bookings", companyQ.data?.id, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, status, customer_name, customer_phone, customer_email, notes, professional_id, service_id, service:services(name, duration_minutes, price_cents), professional:professionals(name)")
        .eq("company_id", companyQ.data!.id)
        .neq("status", "cancelled")
        .gte("start_at", rangeStart.toISOString())
        .lt("start_at", rangeEnd.toISOString())
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime updates for the company
  useEffect(() => {
    const companyId = companyQ.data?.id;
    if (!companyId) return;
    const ch = supabase
      .channel(`cal-bookings-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["cal-bookings", companyId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyQ.data?.id, qc]);

  // Grid time bounds derived from availability (fallback 08-20)
  const [startHour, endHour] = useMemo(() => {
    const rows = availQ.data?.avail ?? [];
    if (rows.length === 0) return [8, 20];
    let s = 24, e = 0;
    for (const r of rows) {
      const [sh] = r.start_time.split(":").map(Number);
      const [eh, em] = r.end_time.split(":").map(Number);
      s = Math.min(s, sh);
      e = Math.max(e, eh + (em > 0 ? 1 : 0));
    }
    return [Math.max(0, s), Math.min(24, Math.max(e, s + 1))];
  }, [availQ.data]);

  const rowsCount = ((endHour - startHour) * 60) / SLOT_MIN;
  const timeLabels = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i <= rowsCount; i++) {
      const mins = startHour * 60 + i * SLOT_MIN;
      const h = Math.floor(mins / 60), m = mins % 60;
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return arr;
  }, [rowsCount, startHour]);

  // Booking filter (visual) by service
  const visibleBookings = useMemo(() => {
    let list = bookingsQ.data ?? [];
    if (proId) list = list.filter((b) => b.professional_id === proId);
    if (svcId) list = list.filter((b) => b.service_id === svcId);
    return list;
  }, [bookingsQ.data, proId, svcId]);

  // Navigation
  const shift = (dir: -1 | 1) => {
    const p = getZonedParts(anchor, tz);
    const delta = view === "day" ? 1 : 7;
    const next = zonedWallToUTC(p.year, p.month, p.day + delta * dir, 12, 0, tz);
    navigate({
      to: "/calendar",
      search: (prev) => ({ ...prev, date: toZonedISODate(next, tz) }),
      replace: true,
    });
  };
  const goToday = () => navigate({
    to: "/calendar", search: (prev) => ({ ...prev, date: undefined }), replace: true,
  });
  const setView = (v: ViewMode) => navigate({
    to: "/calendar", search: (prev) => ({ ...prev, view: v }), replace: true,
  });
  const setPro = (v: string) => navigate({
    to: "/calendar", search: (prev) => ({ ...prev, pro: v || undefined }), replace: true,
  });
  const setSvc = (v: string) => navigate({
    to: "/calendar", search: (prev) => ({ ...prev, svc: v || undefined }), replace: true,
  });

  // Mutations
  const rescheduleMut = useMutation({
    mutationFn: async (v: { id: string; start: Date; end: Date }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ start_at: v.start.toISOString(), end_at: v.end.toISOString() })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento remarcado");
      qc.invalidateQueries({ queryKey: ["cal-bookings"] });
    },
    onError: (e: any) => {
      if (e?.code === "23P01" || String(e?.message ?? "").includes("bookings_no_overlap")) {
        toast.error("Esse horário conflita com outro agendamento.");
      } else if (e?.code === "42501") {
        toast.error("Sem permissão para alterar este agendamento.");
      } else if (e?.code === "23514") {
        toast.error("Horário inválido para o serviço.");
      } else {
        toast.error(e?.message ?? "Não foi possível remarcar.");
      }
      qc.invalidateQueries({ queryKey: ["cal-bookings"] });
    },
  });

  // Create booking dialog state
  const [createFor, setCreateFor] = useState<{ start: Date } | null>(null);

  // Drag state (native HTML5 DnD)
  const dragRef = useRef<{ id: string; durationMin: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  if (companyQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!companyQ.data) { navigate({ to: "/onboarding", replace: true }); return null; }

  const rangeLabel = view === "day"
    ? formatInTZ(days[0], tz, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : `${formatInTZ(days[0], tz, { day: "2-digit", month: "short" })} — ${formatInTZ(days[6], tz, { day: "2-digit", month: "short", year: "numeric" })}`;

  const canInteract = !!proId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Painel
          </Link>
          <p className="text-sm text-muted-foreground">{companyQ.data.name}</p>
        </div>
      </header>

      <main className="container-page py-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Calendário</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Arraste um card para remarcar. Clique num horário livre para criar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button onClick={() => setView("day")} className={`px-3 h-9 text-sm inline-flex items-center gap-1 ${view === "day" ? "bg-foreground text-background" : "hover:bg-accent"}`}>
                <CalendarDays className="size-3.5" /> Dia
              </button>
              <button onClick={() => setView("week")} className={`px-3 h-9 text-sm inline-flex items-center gap-1 ${view === "week" ? "bg-foreground text-background" : "hover:bg-accent"}`}>
                <CalendarRange className="size-3.5" /> Semana
              </button>
            </div>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button onClick={() => shift(-1)} className="px-2 h-9 hover:bg-accent" aria-label="Anterior"><ChevronLeft className="size-4" /></button>
              <button onClick={goToday} className="px-3 h-9 text-sm border-x border-border hover:bg-accent">Hoje</button>
              <button onClick={() => shift(1)} className="px-2 h-9 hover:bg-accent" aria-label="Próximo"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>

        <div className="surface-card p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Profissional</Label>
            <select value={proId} onChange={(e) => setPro(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {prosQ.data?.length === 0 && <option value="">Nenhum profissional</option>}
              {prosQ.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Serviço (filtro)</Label>
            <select value={svcId} onChange={(e) => setSvc(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              {svcsQ.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <p className="text-sm text-muted-foreground md:justify-self-end capitalize">{rangeLabel}</p>
        </div>

        {!canInteract ? (
          <div className="surface-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Cadastre um profissional em <Link to="/settings" className="underline">Configurações</Link> para usar o calendário.</p>
          </div>
        ) : availQ.isLoading || bookingsQ.isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <CalendarGrid
            tz={tz}
            days={days}
            startHour={startHour}
            rowsCount={rowsCount}
            timeLabels={timeLabels}
            avail={availQ.data?.avail ?? []}
            breaks={availQ.data?.breaks ?? []}
            bookings={visibleBookings}
            svcFilter={svcId}
            onClickFreeSlot={(start) => setCreateFor({ start })}
            onDragStart={(id, durationMin) => { dragRef.current = { id, durationMin }; }}
            onDragEnd={() => { dragRef.current = null; setDragOverKey(null); }}
            dragOverKey={dragOverKey}
            setDragOverKey={setDragOverKey}
            onDrop={(start) => {
              const d = dragRef.current;
              dragRef.current = null;
              setDragOverKey(null);
              if (!d) return;
              const end = new Date(start.getTime() + d.durationMin * 60000);
              if (start < new Date()) {
                toast.error("Não é possível mover para o passado.");
                return;
              }
              rescheduleMut.mutate({ id: d.id, start, end });
            }}
          />
        )}
      </main>

      <CreateBookingDialog
        open={!!createFor}
        start={createFor?.start ?? null}
        tz={tz}
        companyId={companyQ.data.id}
        professionalId={proId}
        services={svcsQ.data ?? []}
        defaultServiceId={svcId || (svcsQ.data?.[0]?.id ?? "")}
        onClose={() => setCreateFor(null)}
        onDone={() => {
          setCreateFor(null);
          qc.invalidateQueries({ queryKey: ["cal-bookings"] });
        }}
      />
    </div>
  );
}

/* ---------------- Grid ---------------- */

function CalendarGrid({
  tz, days, startHour, rowsCount, timeLabels, avail, breaks, bookings, svcFilter,
  onClickFreeSlot, onDragStart, onDragEnd, onDrop, dragOverKey, setDragOverKey,
}: {
  tz: string;
  days: Date[];
  startHour: number;
  rowsCount: number;
  timeLabels: string[];
  avail: { day_of_week: number; start_time: string; end_time: string }[];
  breaks: { day_of_week: number; start_time: string; end_time: string }[];
  bookings: any[];
  svcFilter: string;
  onClickFreeSlot: (start: Date) => void;
  onDragStart: (id: string, durationMin: number) => void;
  onDragEnd: () => void;
  onDrop: (start: Date) => void;
  dragOverKey: string | null;
  setDragOverKey: (k: string | null) => void;
}) {
  const now = new Date();

  // Precompute cell metadata per day
  const dayMeta = days.map((d) => {
    const p = getZonedParts(d, tz);
    const dow = p.dow;
    const availToday = avail.filter((a) => a.day_of_week === dow);
    const breakToday = breaks.filter((b) => b.day_of_week === dow);
    return { date: d, parts: p, availToday, breakToday };
  });

  const isFree = (dayIdx: number, rowIdx: number): { free: boolean; start: Date } => {
    const meta = dayMeta[dayIdx];
    const mins = startHour * 60 + rowIdx * SLOT_MIN;
    const h = Math.floor(mins / 60), m = mins % 60;
    const start = zonedWallToUTC(meta.parts.year, meta.parts.month, meta.parts.day, h, m, tz);
    const end = new Date(start.getTime() + SLOT_MIN * 60000);
    const inAvail = meta.availToday.some((a) => {
      const [sh, sm] = a.start_time.split(":").map(Number);
      const [eh, em] = a.end_time.split(":").map(Number);
      const s = zonedWallToUTC(meta.parts.year, meta.parts.month, meta.parts.day, sh, sm, tz);
      const e = zonedWallToUTC(meta.parts.year, meta.parts.month, meta.parts.day, eh, em, tz);
      return start >= s && end <= e;
    });
    if (!inAvail) return { free: false, start };
    const hitsBreak = meta.breakToday.some((b) => {
      const [sh, sm] = b.start_time.split(":").map(Number);
      const [eh, em] = b.end_time.split(":").map(Number);
      const bs = zonedWallToUTC(meta.parts.year, meta.parts.month, meta.parts.day, sh, sm, tz);
      const be = zonedWallToUTC(meta.parts.year, meta.parts.month, meta.parts.day, eh, em, tz);
      return start < be && end > bs;
    });
    if (hitsBreak) return { free: false, start };
    return { free: true, start };
  };

  return (
    <div className="surface-card overflow-auto">
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(120px, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky top-0 z-10 bg-background/95 border-b border-border h-12" />
        {days.map((d, i) => {
          const p = getZonedParts(d, tz);
          const isToday = p.dow === getZonedParts(now, tz).dow &&
            toZonedISODate(d, tz) === toZonedISODate(now, tz);
          return (
            <div key={i} className={`sticky top-0 z-10 bg-background/95 border-b border-l border-border h-12 flex items-center justify-center text-xs ${isToday ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
              <div className="text-center">
                <div className="uppercase tracking-wide">{formatInTZ(d, tz, { weekday: "short" })}</div>
                <div>{formatInTZ(d, tz, { day: "2-digit", month: "short" })}</div>
              </div>
            </div>
          );
        })}

        {/* Time gutter + cells */}
        {Array.from({ length: rowsCount }).map((_, rowIdx) => (
          <RowFragment
            key={rowIdx}
            rowIdx={rowIdx}
            timeLabels={timeLabels}
            days={days}
            dayMeta={dayMeta}
            isFree={isFree}
            onClickFreeSlot={onClickFreeSlot}
            onDrop={onDrop}
            dragOverKey={dragOverKey}
            setDragOverKey={setDragOverKey}
            now={now}
          />
        ))}

        {/* Bookings overlay - absolutely positioned inside day columns via wrapper divs.
            We render them as an overlay at the end using a separate absolutely positioned layer per day. */}
      </div>
      <BookingsOverlay
        tz={tz}
        days={days}
        startHour={startHour}
        rowsCount={rowsCount}
        bookings={bookings}
        svcFilter={svcFilter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
    </div>
  );
}

function RowFragment({
  rowIdx, timeLabels, days, dayMeta, isFree, onClickFreeSlot, onDrop, dragOverKey, setDragOverKey, now,
}: any) {
  return (
    <>
      <div className="h-[28px] border-t border-border/60 text-[10px] text-muted-foreground pr-2 text-right pt-0.5">
        {rowIdx % 2 === 0 ? timeLabels[rowIdx] : ""}
      </div>
      {days.map((_: Date, dayIdx: number) => {
        const { free, start } = isFree(dayIdx, rowIdx);
        const key = `${dayIdx}-${rowIdx}`;
        const past = start < now;
        const canDrop = free && !past;
        return (
          <div
            key={key}
            className={[
              "h-[28px] border-t border-l border-border/60 relative transition-colors",
              free ? "bg-primary/5 hover:bg-primary/15 cursor-pointer" : "bg-muted/40",
              past ? "opacity-60" : "",
              dragOverKey === key && canDrop ? "!bg-primary/30 ring-1 ring-primary/60 ring-inset" : "",
            ].join(" ")}
            onClick={() => { if (canDrop) onClickFreeSlot(start); }}
            onDragOver={(e) => {
              if (!canDrop) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverKey !== key) setDragOverKey(key);
            }}
            onDragLeave={() => { if (dragOverKey === key) setDragOverKey(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (!canDrop) return;
              onDrop(start);
            }}
            aria-label={free ? "Horário livre" : "Indisponível"}
          />
        );
      })}
    </>
  );
}

function BookingsOverlay({
  tz, days, startHour, rowsCount, bookings, svcFilter, onDragStart, onDragEnd,
}: {
  tz: string;
  days: Date[];
  startHour: number;
  rowsCount: number;
  bookings: any[];
  svcFilter: string;
  onDragStart: (id: string, durationMin: number) => void;
  onDragEnd: () => void;
}) {
  // Total grid width uses same template as parent — for overlay we compute
  // percent-based left/top over a mirrored grid below the visible one.
  const gutterPct = 72; // px, will be handled via CSS grid mirror.
  return (
    <div
      className="grid min-w-[720px] pointer-events-none -mt-[calc(28px_*_var(--rows))]"
      style={{
        // @ts-expect-error CSS var
        "--rows": rowsCount,
        gridTemplateColumns: `${gutterPct}px repeat(${days.length}, minmax(120px, 1fr))`,
        height: `${rowsCount * ROW_PX}px`,
      }}
    >
      <div />
      {days.map((d, dayIdx) => {
        const p = getZonedParts(d, tz);
        const dayStart = zonedWallToUTC(p.year, p.month, p.day, startHour, 0, tz).getTime();
        const dayEnd = dayStart + rowsCount * SLOT_MIN * 60000;
        const dayBookings = bookings.filter((b) => {
          const s = new Date(b.start_at).getTime();
          return s >= dayStart && s < dayEnd;
        });
        return (
          <div key={dayIdx} className="relative border-l border-transparent">
            {dayBookings.map((b) => {
              const s = new Date(b.start_at).getTime();
              const e = new Date(b.end_at).getTime();
              const topMin = (s - dayStart) / 60000;
              const durMin = Math.max(SLOT_MIN, (e - s) / 60000);
              const top = (topMin / SLOT_MIN) * ROW_PX;
              const height = (durMin / SLOT_MIN) * ROW_PX - 2;
              const dim = svcFilter && b.service_id !== svcFilter;
              const status = b.status as string;
              const tone =
                status === "pending" ? "bg-amber-500/20 border-amber-500/60 text-amber-100" :
                status === "confirmed" ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-100" :
                "bg-muted border-border";
              return (
                <div
                  key={b.id}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.effectAllowed = "move";
                    ev.dataTransfer.setData("text/plain", b.id);
                    onDragStart(b.id, (b.service?.duration_minutes ?? Math.round((e - s) / 60000)));
                  }}
                  onDragEnd={onDragEnd}
                  className={[
                    "absolute left-1 right-1 rounded-md border px-2 py-1 text-[11px] leading-tight pointer-events-auto cursor-grab active:cursor-grabbing shadow-sm overflow-hidden",
                    tone,
                    dim ? "opacity-30" : "opacity-100",
                  ].join(" ")}
                  style={{ top, height }}
                  title={`${b.customer_name} · ${b.service?.name ?? ""}`}
                >
                  <div className="font-medium truncate">
                    {formatInTZ(new Date(s), tz, { hour: "2-digit", minute: "2-digit" })} · {b.customer_name}
                  </div>
                  {height > 24 && (
                    <div className="truncate opacity-80">{b.service?.name}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Create dialog ---------------- */

const createSchema = z.object({
  service_id: z.string().uuid("Selecione o serviço"),
  customer_name: z.string().trim().min(2, "Informe o nome").max(120),
  customer_phone: z.string().trim().min(6, "Telefone inválido").max(30),
  customer_email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function CreateBookingDialog({
  open, start, tz, companyId, professionalId, services, defaultServiceId, onClose, onDone,
}: {
  open: boolean;
  start: Date | null;
  tz: string;
  companyId: string;
  professionalId: string;
  services: { id: string; name: string; duration_minutes: number; price_cents: number }[];
  defaultServiceId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [serviceId, setServiceId] = useState(defaultServiceId);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setServiceId(defaultServiceId);
      setForm({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
      setErrors({});
    }
  }, [open, defaultServiceId]);

  const svc = services.find((s) => s.id === serviceId);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!start) throw new Error("Sem horário");
      const parsed = createSchema.safeParse({ service_id: serviceId, ...form });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const i of parsed.error.issues) errs[i.path.join(".")] = i.message;
        setErrors(errs);
        throw new Error("validation");
      }
      if (!svc) throw new Error("Serviço inválido");
      const end = new Date(start.getTime() + svc.duration_minutes * 60000);
      const insert = await supabase
        .from("bookings")
        .insert({
          company_id: companyId,
          professional_id: professionalId,
          service_id: serviceId,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          status: "pending",
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_email: form.customer_email.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select("id")
        .single();
      if (insert.error) throw insert.error;
      // Owner-created → auto-confirm
      const upd = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", insert.data.id);
      if (upd.error) throw upd.error;
    },
    onSuccess: () => { toast.success("Agendamento criado"); onDone(); },
    onError: (e: any) => {
      if (e?.message === "validation") return;
      if (e?.code === "23P01" || String(e?.message ?? "").includes("bookings_no_overlap")) {
        toast.error("Este horário conflita com outro agendamento.");
      } else if (e?.code === "42501") {
        toast.error("Dados fora das regras (verifique horário e serviço).");
      } else if (e?.code === "23514") {
        toast.error("Dados inválidos para o agendamento.");
      } else {
        toast.error(e?.message ?? "Não foi possível criar.");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            {start && (
              <>Início em {formatInTZ(start, tz, { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Selecione…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>
              ))}
            </select>
            {errors.service_id && <p className="text-xs text-destructive">{errors.service_id}</p>}
            {svc && start && (
              <p className="text-xs text-muted-foreground">
                Término previsto: {formatInTZ(new Date(start.getTime() + svc.duration_minutes * 60000), tz, { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              {errors.customer_phone && <p className="text-xs text-destructive">{errors.customer_phone}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail (opcional)</Label>
            <Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            {errors.customer_email && <p className="text-xs text-destructive">{errors.customer_email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <button onClick={onClose} className="btn-ghost h-9 !px-3 text-xs">Cancelar</button>
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !serviceId} className="btn-primary h-9 !px-3 text-xs">
            {createMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Criar agendamento
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const _icons = { X, User, Phone, Mail, StickyNote };