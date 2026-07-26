import { useRef, useState } from "react";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadCompanyMedia, removeCompanyMedia, type UploadKind } from "@/lib/media";

type Props = {
  companyId: string;
  kind: UploadKind;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  aspect?: "square" | "cover" | "portrait";
  label?: string;
  hint?: string;
};

export function MediaUploader({ companyId, kind, value, onChange, aspect = "square", label, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const aspectCls =
    aspect === "cover" ? "aspect-[16/6]" : aspect === "portrait" ? "aspect-[3/4]" : "aspect-square";

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const prev = value;
      const { url } = await uploadCompanyMedia(companyId, kind, file);
      onChange(url);
      if (prev) removeCompanyMedia(prev).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div
        className={`relative w-full ${aspectCls} rounded-xl border border-dashed border-border overflow-hidden bg-muted/30 group`}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="size-6" />
            <span className="text-xs">Nenhuma imagem</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-end p-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-8 px-3 text-xs rounded-md bg-background/90 border border-border shadow-sm inline-flex items-center gap-1.5"
          >
            <Upload className="size-3.5" /> {value ? "Trocar" : "Enviar"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                const prev = value;
                onChange(null);
                removeCompanyMedia(prev).catch(() => {});
              }}
              className="h-8 px-2 text-xs rounded-md bg-background/90 border border-border shadow-sm text-red-500"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}