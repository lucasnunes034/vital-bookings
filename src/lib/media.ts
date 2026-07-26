import { supabase } from "@/integrations/supabase/client";

const BUCKET = "company-media";
const LONG_TTL = 60 * 60 * 24 * 365 * 10; // 10 anos

export type UploadKind = "logo" | "cover" | "gallery" | "professional" | "service";

export async function uploadCompanyMedia(
  companyId: string,
  kind: UploadKind,
  file: File,
): Promise<{ path: string; url: string }> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo maior que 8 MB.");
  if (!/^image\//.test(file.type)) throw new Error("Envie uma imagem (jpg, png, webp).");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${companyId}/${kind}/${crypto.randomUUID()}.${ext || "jpg"}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (up.error) throw up.error;
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, LONG_TTL);
  if (signed.error) throw signed.error;
  return { path, url: signed.data.signedUrl };
}

export async function removeCompanyMedia(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const m = url.match(/\/company-media\/([^?]+)\?/);
  if (!m) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(m[1])]);
}