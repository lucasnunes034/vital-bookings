import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, BarChart3, CheckCircle2, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { REVENUE_MOCK, buildChartData, type PeriodKey } from "@/lib/reports-mock";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ReportsPage() {
  const [period, setPeriod] = useState<PeriodKey>("current_month");

  const rows = useMemo(() => REVENUE_MOCK.filter((r) => r.period === period), [period]);
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  const count = rows.length;
  const avg = count ? Math.round(total / count) : 0;
  const chart = useMemo(() => buildChartData(period, rows), [period, rows]);

  return (
    <main className="container-page min-w-0 py-8 space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <Link to="/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-4 shrink-0" /> Voltar
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-1 truncate">
            Relatórios e Financeiro
          </h1>
        </div>
        <Button variant="outline" className="hidden sm:inline-flex">
          <Download className="size-4" /> Exportar Relatório (PDF)
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="h-12 w-full sm:w-56">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">Mês Atual</SelectItem>
            <SelectItem value="last_month">Mês Passado</SelectItem>
            <SelectItem value="this_year">Este Ano</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-12 w-full sm:hidden">
          <Download className="size-4" /> Exportar Relatório (PDF)
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <SummaryCard icon={BarChart3} label="Faturamento Total" value={brl(total)} />
        <SummaryCard icon={CheckCircle2} label="Serviços Concluídos" value={String(count)} />
        <SummaryCard icon={Receipt} label="Ticket Médio" value={brl(avg)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {period === "this_year" ? "Faturamento por mês" : "Faturamento por semana"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] w-full"
            config={{ revenue: { label: "Faturamento", color: "hsl(var(--primary))" } }}
          >
            <BarChart data={chart} margin={{ left: 4, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                fontSize={11}
                tickFormatter={(v: number) => `R$${Math.round(v / 100)}`}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />}
              />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas do período</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile: cards empilhados */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.customer}</p>
                    <p className="text-sm text-muted-foreground truncate">{r.service}</p>
                  </div>
                  <span className="shrink-0 font-semibold">{brl(r.amount_cents)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.date).toLocaleDateString("pt-BR")}
                  </span>
                  <Badge variant="secondary">Concluído</Badge>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{r.customer}</TableCell>
                    <TableCell className="text-muted-foreground">{r.service}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(r.amount_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">Total geral</span>
            <span className="text-xl md:text-2xl font-semibold">{brl(total)}</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios e Financeiro — Slotly" },
      { name: "description", content: "Acompanhe faturamento, serviços concluídos e ticket médio da sua empresa." },
      { property: "og:title", content: "Relatórios e Financeiro — Slotly" },
      { property: "og:description", content: "Faturamento, serviços concluídos e ticket médio por período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
