import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { buildBookingWhatsAppMessage, buildWhatsappUrl } from "@/lib/whatsapp";

type Booking = {
  id: string;
  start_at: string;
  customer_name: string;
  customer_phone: string | null;
  service?: { name?: string | null } | null;
};

type Props = {
  booking: Booking;
  companyName: string;
  tz?: string;
  size?: "sm" | "xs";
  label?: string;
};

export function BookingWhatsAppButton({
  booking,
  companyName,
  tz = "America/Sao_Paulo",
  size = "sm",
  label = "WhatsApp",
}: Props) {
  const handleClick = () => {
    const message = buildBookingWhatsAppMessage({
      customerName: booking.customer_name,
      companyName,
      serviceName: booking.service?.name || "Serviço",
      startAt: booking.start_at,
      tz,
    });
    const url = buildWhatsappUrl(booking.customer_phone, message);

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    const blocked = !popup || popup.closed || typeof popup.closed === "undefined";

    if (blocked) {
      void navigator.clipboard.writeText(url).then(
        () => toast.success("Link do WhatsApp copiado", { description: "O navegador bloqueou o popup. Cole no app." }),
        () => toast.error("Não foi possível abrir o WhatsApp")
      );
    }
  };

  const btnClass =
    size === "xs"
      ? "btn-ghost h-8 !px-2 text-xs"
      : "btn-ghost h-9 !px-3 text-xs";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={btnClass}
      title="Enviar confirmação por WhatsApp"
    >
      <MessageCircle className="size-3.5" style={{ color: "#25D366" }} /> {label}
    </button>
  );
}
