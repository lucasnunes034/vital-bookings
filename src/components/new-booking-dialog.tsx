import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { zonedWallToUTC, getZonedParts, formatInTZ } from "@/lib/timezone";
import { mapBookingError } from "@/lib/booking-errors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  tz: string;
  initialStart?: Date | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function NewBookingDialog({ open, onOpenChange, companyId, tz, initialStart }: Props) {
  const qc = useQueryClient();

  const prosQ = useQuery({
    enabled: open && !!companyId,
    queryKey: ["nb-pros", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const svcsQ = useQuery({
    enabled: open && !!companyId,
    queryKey: ["nb-svcs", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const customersQ = useQuery({
    enabled: open && !!companyId,
    queryKey: ["nb-customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [customerId, setCustomerId] = useState("");
  const [proId, setProId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const base = initialStart ?? new Date();
    const p = getZonedParts(base, tz);
    setDate(`${p.year}-${pad(p.month)}-${pad(p.day)}`);
    setTime(initialStart ? `${pad(p.hour)}:${pad(p.minute)}` : "09:00");
    setCustomerId("");
    setServiceId("");
    setForm({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
    setErrors({});
  }, [open, initialStart, tz]);

  useEffect(() => {
    if (open && !proId && prosQ.data?.length) setProId(prosQ.data[0].id);
  }, [open, proId, prosQ.data]);

  const svc = svcsQ.data?.find((s) => s.id === serviceId);

  const startAt = useMemo(() => {
    if (!date || !time) return null;
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
    return zonedWallToUTC(y, mo, d, h, mi, tz);
  }, [date, time, tz]);

  const endAt = svc && startAt ? new Date(startAt.getTime() + svc.duration_minutes * 60000) : null;

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customersQ.data?.find((x) => x.id === id);
    if (c) {
      setForm((f) => ({ ...f, customer_name: c.name ?? "", customer_phone: c.phone ?? "", customer_email: c.email ?? "" }));
    }
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const errs: Record<string, string> = {};
      if (!proId) errs.professional_id = "Selecione o profissional";
      if (!serviceId) errs.service_id = "Selecione o serviço";
      if (form.customer_name.trim().length < 2) errs.customer_name = "Informe o nome do cliente";
      if (form.customer_phone.trim().length < 6) errs.customer_phone = "Telefone inválido";
      if (!startAt) errs.date = "Data/hora inválida";
      setErrors(errs);
      if (Object.keys(errs).length) throw new Error("validation");

      const end = new Date(startAt!.getTime() + (svc?.duration_minutes ?? 30) * 60000);
      const insert = await supabase
        .from("bookings")
        .insert({
          company_id: companyId,
          professional_id: proId,
          service_id: serviceId,
          start_at: startAt!.toISOString(),
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
      const upd = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", insert.data.id);
      if (upd.error) throw upd.error;
    },
    onSuccess: () => {
      toast.success("Agendamento confirmado");
      qc.invalidateQueries({ queryKey: ["cal-bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e?.message === "validation") return;
      const m = mapBookingError(e, "create");
      toast.error(m.message, m.description ? { description: m.description } : undefined);
    },
  });

  const noPros = prosQ.data?.length === 0;
  const noSvcs = svcsQ.data?.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!createMut.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>Crie um atendimento manualmente. Ele já entra como confirmado.</DialogDescription>
        </DialogHeader>

        {noPros || noSvcs ? (
          <p className="text-sm text-muted-foreground">
            {noPros ? "Cadastre um profissional" : "Cadastre um serviço"} em Configurações antes de agendar.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente cadastrado</Label>
              <select
                value={customerId}
                onChange={(e) => pickCustomer(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Novo cliente / avulso…</option>
                {customersQ.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Label>Serviço</Label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {svcsQ.data?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>
                ))}
              </select>
              {errors.service_id && <p className="text-xs text-destructive">{errors.service_id}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <select
                value={proId}
                onChange={(e) => setProId(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                {prosQ.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.professional_id && <p className="text-xs text-destructive">{errors.professional_id}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            {endAt && (
              <p className="text-xs text-muted-foreground">
                Término previsto: {formatInTZ(endAt, tz, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        )}

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="btn-ghost h-10 !px-4 text-sm">Cancelar</button>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || noPros || noSvcs}
            className="btn-primary h-10 !px-4 text-sm"
          >
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Criar agendamento
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
