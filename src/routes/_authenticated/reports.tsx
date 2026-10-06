import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { downloadElementAsPdf } from "@/lib/pdf";
import { ArrowLeft, Download, BarChart3, CheckCircle2, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { buildChartData, type PeriodKey, type RevenueRow } from "@/lib/reports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function periodOf(d: Date): PeriodKey[] {
  const now = new Date();
  const out: PeriodKey[] = [];
  if (d.getFullYear() === now.getFullYear()) out.push("this_year");
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) out.push("current_month");
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()) out.push("last_month");
  return out;
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ReportsPage() {
  const [period, setPeriod] = useState<PeriodKey>("current_month");
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  async function handlePdf() {
    if (!reportRef.current) return;
    setPdfBusy(true);
    try { await downloadElementAsPdf(reportRef.current, "relatorio-financeiro.pdf"); }
    catch (e) { console.error(e); toast.error("Não foi possível gerar o PDF."); }
    finally { setPdfBusy(false); }
  }

  const revQ = useQuery({
    queryKey: ["revenues"],
    queryFn: async () => {
      const start = new Date(new Date().getFullYear() - 1, 11, 1).toLocaleDateString("en-CA");
      const { data, error } = await supabase
        .from("revenues")
        .select("id, title, customer_name, amount_cents, received_at")
        .gte("received_at", start)
        .order("received_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo<RevenueRow[]>(() => {
    const out: RevenueRow[] = [];
    for (const r of revQ.data ?? []) {
      const d = new Date(`${r.received_at}T12:00:00`);
      if (!periodOf(d).includes(period)) continue;
      out.push({
        id: r.id, period, date: d.toISOString(), customer: r.customer_name ?? "—", service: r.title,
        amount_cents: r.amount_cents, week: Math.min(4, Math.ceil(d.getDate() / 7)), month: d.getMonth(),
      });
    }
    return out;
  }, [revQ.data, period]);
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  const count = rows.length;
  const avg = count ? Math.round(total / count) : 0;
  const chart = useMemo(() => buildChartData(period, rows), [period, rows]);

  return (
    <main className="container-page min-w-0 py-8 space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <Link to="/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline print:hidden">
            <ArrowLeft className="size-4 shrink-0" /> Voltar
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-1 truncate">
            Relatórios e Financeiro
          </h1>
        </div>
        <Button variant="outline" className="hidden sm:inline-flex" onClick={handlePdf} disabled={pdfBusy}>
          <Download className="size-4" /> Exportar Relatório (PDF)
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
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
        <Button variant="outline" className="h-12 w-full sm:hidden" onClick={handlePdf} disabled={pdfBusy}>
          <Download className="size-4" /> Exportar Relatório (PDF)
        </Button>
      </div>

      <div ref={reportRef} className="space-y-6 bg-background">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <SummaryCard icon={BarChart3} label="Faturamento Total" value={brl(total)} />
        <SummaryCard icon={CheckCircle2} label="Serviços Concluídos" value={String(count)} />
        <SummaryCard icon={Receipt} label="Ticket Médio" value={brl(avg)} />
      </div>

      <Card className="print:break-inside-avoid">
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

      <Card className="print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">Receitas do período</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma receita neste período. Conclua um agendamento e lance o valor no Financeiro.
            </p>
          )}
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
      </div>
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
