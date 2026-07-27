import type { ThemeTemplateId, ThemeFont } from "./types";

export type TemplatePreset = {
  id: ThemeTemplateId;
  label: string;
  emoji: string;
  primary: string;
  secondary: string;
  accent: string;
  font: ThemeFont;
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: "default",   label: "Padrão",     emoji: "✨", primary: "#5E6AD2", secondary: "#8B5CF6", accent: "#10B981", font: "Inter" },
  { id: "barbearia", label: "Barbearia",  emoji: "💈", primary: "#B91C1C", secondary: "#0F172A", accent: "#F59E0B", font: "Montserrat" },
  { id: "salao",     label: "Salão",      emoji: "💇", primary: "#DB2777", secondary: "#7C3AED", accent: "#F472B6", font: "Poppins" },
  { id: "estetica",  label: "Estética",   emoji: "💅", primary: "#EC4899", secondary: "#A855F7", accent: "#FBBF24", font: "Poppins" },
  { id: "dentista",  label: "Dentista",   emoji: "🦷", primary: "#0EA5E9", secondary: "#1E3A8A", accent: "#22D3EE", font: "Inter" },
  { id: "clinica",   label: "Clínica",    emoji: "💉", primary: "#2563EB", secondary: "#0F766E", accent: "#10B981", font: "Inter" },
  { id: "petshop",   label: "Pet Shop",   emoji: "🐶", primary: "#F97316", secondary: "#0EA5E9", accent: "#84CC16", font: "Poppins" },
  { id: "academia",  label: "Academia",   emoji: "🏋️", primary: "#EF4444", secondary: "#111827", accent: "#F59E0B", font: "Montserrat" },
  { id: "studio",    label: "Studio",     emoji: "🧘", primary: "#059669", secondary: "#065F46", accent: "#A7F3D0", font: "Montserrat" },
];

export function getTemplate(id: ThemeTemplateId): TemplatePreset {
  return TEMPLATE_PRESETS.find((t) => t.id === id) ?? TEMPLATE_PRESETS[0];
}