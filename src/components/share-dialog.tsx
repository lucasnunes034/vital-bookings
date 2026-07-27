import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Download, MessageCircle, Facebook, Twitter, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = { open: boolean; onClose: () => void; url: string; title: string };

export function ShareDialog({ open, onClose, url, title }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Sample computed theme colors so the QR follows the company brand.
    const styles = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
    const toHex = (v: string, fallback: string) => {
      const s = (v || "").trim();
      return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : fallback;
    };
    const dark = toHex(styles?.getPropertyValue("--foreground") ?? "", "#0a0a0a");
    const light = toHex(styles?.getPropertyValue("--background") ?? "", "#ffffff");
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark, light } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function download() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-qrcode.png`;
    a.click();
  }

  const enc = encodeURIComponent(url);
  const msg = encodeURIComponent(`Agende comigo pelo Slotly: ${url}`);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar {title}</DialogTitle>
          <DialogDescription>Envie o link ou imprima o QR Code para receber agendamentos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background p-4 flex items-center justify-center">
            {qr ? <img src={qr} alt="QR Code" className="w-56 h-56" /> : <div className="w-56 h-56" />}
          </div>
          <div className="flex gap-2">
            <button onClick={download} disabled={!qr} className="btn-ghost flex-1 h-10 text-sm">
              <Download className="size-4" /> Baixar QR
            </button>
            <button onClick={copy} className="btn-ghost flex-1 h-10 text-sm">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${msg}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-10 rounded-md border border-border inline-flex items-center justify-center gap-1.5 text-sm hover:bg-muted/40"
            >
              <MessageCircle className="size-4 text-success" /> WhatsApp
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-10 rounded-md border border-border inline-flex items-center justify-center gap-1.5 text-sm hover:bg-muted/40"
            >
              <Facebook className="size-4 text-primary" />
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${enc}&text=${msg}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-10 rounded-md border border-border inline-flex items-center justify-center gap-1.5 text-sm hover:bg-muted/40"
            >
              <Twitter className="size-4" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-md px-3 py-2">
            <Link2 className="size-3.5 shrink-0" />
            <span className="truncate">{url}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}