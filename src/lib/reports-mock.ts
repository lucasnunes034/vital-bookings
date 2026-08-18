export type PeriodKey = "current_month" | "last_month" | "this_year";

export type RevenueRow = {
  id: string;
  period: PeriodKey;
  date: string; // ISO
  customer: string;
  service: string;
  amount_cents: number;
  week: number; // 1..4 dentro do mês
  month: number; // 0..11
};

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const lastMonthDate = new Date(y, m - 1, 1);

function d(year: number, month: number, day: number) {
  return new Date(year, month, day, 10, 0, 0).toISOString();
}
function weekOf(day: number) {
  return Math.min(4, Math.ceil(day / 7));
}

type Seed = [day: number, customer: string, service: string, brl: number];

const CURRENT: Seed[] = [
  [2, "Marcela Andrade", "Limpeza de split 12.000 BTUs", 180],
  [3, "Condomínio Vista Verde", "Higienização de 4 splits (área comum)", 620],
  [5, "Rafael Teixeira", "Recarga de gás R-410A", 340],
  [8, "Padaria Pão Dourado", "Manutenção preventiva cassete", 450],
  [9, "Juliana Prado", "Instalação de split 9.000 BTUs", 780],
  [12, "Studio Belle Hair", "Limpeza + troca de filtros", 260],
  [15, "Carlos Menezes", "Reparo de vazamento na tubulação", 520],
  [17, "Ana Beatriz Lopes", "Limpeza de split 18.000 BTUs", 220],
  [19, "Clínica OdontoSul", "Contrato mensal — 6 aparelhos", 980],
  [22, "Fernando Rocha", "Recarga de gás + higienização", 410],
  [25, "Mercado Bom Preço", "Instalação de piso-teto 36.000 BTUs", 1450],
  [27, "Patrícia Nogueira", "Limpeza de ar-condicionado janela", 150],
];

const LAST: Seed[] = [
  [4, "Escritório Lima & Souza", "Manutenção preventiva (3 splits)", 540],
  [6, "Tiago Barros", "Instalação de split 12.000 BTUs", 850],
  [10, "Academia Corpo Ativo", "Higienização de 5 splits", 720],
  [13, "Sandra Vieira", "Recarga de gás R-32", 360],
  [16, "Restaurante Sabor Caseiro", "Reparo de placa eletrônica", 480],
  [18, "Hugo Martins", "Limpeza de split 9.000 BTUs", 160],
  [21, "Imobiliária Alvorada", "Vistoria + limpeza (2 unidades)", 390],
  [24, "Camila Ferraz", "Troca de compressor", 1200],
  [28, "Pet Shop Focinho Feliz", "Instalação de cortina de ar", 690],
];

function build(seeds: Seed[], year: number, month: number, period: PeriodKey): RevenueRow[] {
  return seeds.map(([day, customer, service, brl], i) => ({
    id: `${period}-${i}`,
    period,
    date: d(year, month, day),
    customer,
    service,
    amount_cents: brl * 100,
    week: weekOf(day),
    month,
  }));
}

const currentRows = build(CURRENT, y, m, "current_month");
const lastRows = build(LAST, lastMonthDate.getFullYear(), lastMonthDate.getMonth(), "last_month");

// Ano: meses anteriores sintéticos + os dois meses reais acima
const YEAR_SEEDS: Array<[monthOffset: number, seeds: Seed[]]> = [
  [-5, [[7, "Hotel Praia Azul", "Manutenção de 8 splits", 1580], [20, "Diego Almeida", "Recarga de gás", 330]]],
  [-4, [[9, "Colégio Novo Saber", "Higienização de 10 aparelhos", 1890], [23, "Renata Coelho", "Limpeza de split", 190]]],
  [-3, [[5, "Bar do Zeca", "Instalação de split 18.000 BTUs", 1100], [26, "Luís Fernando", "Reparo de dreno", 240]]],
  [-2, [[11, "Consultório Dra. Helena", "Contrato mensal — 3 aparelhos", 640], [22, "Bruna Nascimento", "Limpeza + gás", 420]]],
];

const yearExtra: RevenueRow[] = YEAR_SEEDS.flatMap(([offset, seeds]) => {
  const dt = new Date(y, m + offset, 1);
  return build(seeds, dt.getFullYear(), dt.getMonth(), "this_year");
}).map((r, i) => ({ ...r, id: `year-extra-${i}` }));

const yearRows: RevenueRow[] = [
  ...yearExtra,
  ...lastRows.map((r, i) => ({ ...r, period: "this_year" as const, id: `year-last-${i}` })),
  ...currentRows.map((r, i) => ({ ...r, period: "this_year" as const, id: `year-cur-${i}` })),
].sort((a, b) => a.date.localeCompare(b.date));

export const REVENUE_MOCK: RevenueRow[] = [...currentRows, ...lastRows, ...yearRows];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function buildChartData(period: PeriodKey, rows: RevenueRow[]) {
  if (period === "this_year") {
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.month, (map.get(r.month) ?? 0) + r.amount_cents);
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([month, revenue]) => ({ label: MONTHS[month], revenue }));
  }
  return [1, 2, 3, 4].map((w) => ({
    label: `Sem ${w}`,
    revenue: rows.filter((r) => r.week === w).reduce((s, r) => s + r.amount_cents, 0),
  }));
}
