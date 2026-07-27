import { ensureReadable, readableOn } from "./contrast";
import { DEFAULT_THEME, type CompanyTheme, type ThemeFont, type ThemeMode } from "./types";

const FONT_LINK_ID = "slotly-theme-font";
const STYLE_ID = "slotly-theme-style";

const FONT_GOOGLE: Record<ThemeFont, string> = {
  Inter: "Inter:wght@400;500;600;700",
  Poppins: "Poppins:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
};

function ensureFontLoaded(font: ThemeFont) {
  if (typeof document === "undefined") return;
  const href = `https://fonts.googleapis.com/css2?family=${FONT_GOOGLE[font]}&display=swap`;
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

function ensureFavicon(url: string | null) {
  if (typeof document === "undefined" || !url) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

function buildCss(theme: CompanyTheme): { css: string; scheme: "light" | "dark" } {
  const mode = resolveMode(theme.theme_mode);
  const isLight = mode === "light";

  const bg = isLight ? "#FFFFFF" : "#0F0F14";
  const fg = isLight ? "#0A0A0A" : "#F5F5F7";
  const surface = isLight ? "#F7F7F9" : "#17181F";
  const surface2 = isLight ? "#EFEFF3" : "#20222B";
  const border = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const input = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const muted = isLight ? "#F1F1F4" : "#20222B";
  const mutedFg = isLight ? "#5A5A66" : "#A6A8B3";

  const primary = ensureReadable(theme.primary_color, bg, 2.5).color;
  const secondary = ensureReadable(theme.secondary_color, bg, 2.5).color;
  const accent = ensureReadable(theme.accent_color, bg, 2.5).color;

  const primaryFg = readableOn(primary);
  const secondaryFg = readableOn(secondary);
  const accentFg = readableOn(accent);

  const css = `:root{
    --background:${bg};
    --foreground:${fg};
    --surface:${surface};
    --surface-2:${surface2};
    --card:${surface};
    --card-foreground:${fg};
    --popover:${surface};
    --popover-foreground:${fg};
    --primary:${primary};
    --primary-foreground:${primaryFg};
    --brand:${primary};
    --brand-2:${secondary};
    --secondary:${muted};
    --secondary-foreground:${fg};
    --muted:${muted};
    --muted-foreground:${mutedFg};
    --accent:${accent};
    --accent-foreground:${accentFg};
    --border:${border};
    --input:${input};
    --ring:${primary};
    --gradient-brand:linear-gradient(135deg, ${primary}, ${secondary});
    --gradient-hero:radial-gradient(ellipse 80% 60% at 50% 0%, ${primary}40, transparent 70%);
    --shadow-glow:0 0 60px -10px ${primary}80;
    --font-sans:"${theme.font_family}", ui-sans-serif, system-ui, sans-serif;
    --font-display:"${theme.font_family}", ui-sans-serif, system-ui, sans-serif;
  }`;

  return { css, scheme: mode };
}

export function applyTheme(partial: Partial<CompanyTheme> & { company_id?: string }) {
  if (typeof document === "undefined") return;
  const theme: CompanyTheme = {
    company_id: partial.company_id ?? "",
    ...DEFAULT_THEME,
    ...partial,
  };
  const { css, scheme } = buildCss(theme);

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;

  document.documentElement.style.colorScheme = scheme;
  document.documentElement.dataset.themeMode = scheme;

  ensureFontLoaded(theme.font_family);
  ensureFavicon(theme.favicon_url);
}

export function resetTheme() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
  document.documentElement.style.colorScheme = "";
  delete document.documentElement.dataset.themeMode;
}