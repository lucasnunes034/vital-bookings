export type ThemeMode = "light" | "dark" | "auto";
export type ThemeFont = "Inter" | "Poppins" | "Roboto" | "Montserrat";
export type ThemeTemplateId =
  | "default"
  | "barbearia"
  | "salao"
  | "estetica"
  | "dentista"
  | "clinica"
  | "petshop"
  | "academia"
  | "studio";

export type CompanyTheme = {
  company_id: string;
  template_id: ThemeTemplateId;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  theme_mode: ThemeMode;
  font_family: ThemeFont;
  logo_url: string | null;
  favicon_url: string | null;
  banner_url: string | null;
  display_name: string | null;
  tagline: string | null;
};

export const DEFAULT_THEME: Omit<CompanyTheme, "company_id"> = {
  template_id: "default",
  primary_color: "#5E6AD2",
  secondary_color: "#8B5CF6",
  accent_color: "#10B981",
  theme_mode: "dark",
  font_family: "Inter",
  logo_url: null,
  favicon_url: null,
  banner_url: null,
  display_name: null,
  tagline: null,
};