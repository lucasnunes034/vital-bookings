// WCAG contrast helpers. Colors as #RRGGBB.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function relLum([r, g, b]: [number, number, number]) {
  const s = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

export function contrastRatio(fg: string, bg: string) {
  const l1 = relLum(hexToRgb(fg));
  const l2 = relLum(hexToRgb(bg));
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

export function readableOn(bg: string): "#FFFFFF" | "#0A0A0A" {
  return contrastRatio("#FFFFFF", bg) >= contrastRatio("#0A0A0A", bg) ? "#FFFFFF" : "#0A0A0A";
}

function adjustLightness(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + 255 * delta, g + 255 * delta, b + 255 * delta);
}

/**
 * Returns { color, adjusted, ratio, warning } — nudges color toward better contrast
 * against bg if ratio < 3 (loose readability requirement for large UI elements).
 */
export function ensureReadable(color: string, bg: string, min = 3) {
  let out = color;
  let ratio = contrastRatio(out, bg);
  let adjusted = false;
  const bgLum = relLum(hexToRgb(bg));
  const step = bgLum > 0.5 ? -0.08 : 0.08; // darken on light bg, lighten on dark
  let guard = 0;
  while (ratio < min && guard < 6) {
    out = adjustLightness(out, step);
    ratio = contrastRatio(out, bg);
    adjusted = true;
    guard++;
  }
  return { color: out, ratio, adjusted, warning: ratio < min };
}

export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}