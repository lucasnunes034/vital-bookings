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
