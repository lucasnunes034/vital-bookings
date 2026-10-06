import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export type RevenueBooking = {
  id: string;
  company_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email?: string | null;
  service?: { name: string; price_cents: number } | null;
};

/** Pergunta se o valor do agendamento concluído deve ir para o Financeiro. */
export function RevenuePromptDialog({ booking, onClose }: { booking: RevenueBooking | null; onClose: () => void }) {
  const qc = useQueryClient();
  const amount = booking?.service?.price_cents ?? 0;

  const create = useMutation({
    mutationFn: async (b: RevenueBooking) => {
      // Vincula ao cliente cadastrado (mesmo telefone/e-mail) quando existir.
      let customerId: string | null = null;
      const ors = [b.customer_phone && `phone.eq.${b.customer_phone}`, b.customer_email && `email.eq.${b.customer_email}`]
        .filter(Boolean).join(",");
      if (ors) {
        const { data } = await supabase.from("customers").select("id")
          .eq("company_id", b.company_id).or(ors).limit(1);
        customerId = data?.[0]?.id ?? null;
      }
      const { error } = await supabase.from("revenues").insert({
        company_id: b.company_id,
        booking_id: b.id,
        customer_id: customerId,
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        title: b.service?.name ?? "Serviço",
        amount_cents: b.service?.price_cents ?? 0,
        received_at: new Date().toLocaleDateString("en-CA"),
      });
      if (error) {
        if (error.code === "23505") throw new Error("Este agendamento já foi lançado no Financeiro.");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      toast.success("Receita lançada no Financeiro");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível lançar a receita."),
  });

  return (
    <AlertDialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deseja lançar este valor no Financeiro?</AlertDialogTitle>
          <AlertDialogDescription>
            {booking?.service?.name ?? "Serviço"} · {booking?.customer_name} ·{" "}
            {(amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-12">Agora não</AlertDialogCancel>
          <AlertDialogAction
            className="h-12"
            disabled={create.isPending}
            onClick={(e) => { e.preventDefault(); if (booking) create.mutate(booking); }}
          >
            Sim, lançar receita
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
