import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Slotly — Agendamento online para qualquer negócio" },
      {
        name: "description",
        content:
          "Slotly é o SaaS de agendamento para barbearias, clínicas, salões, estúdios, pet shops e mais. Agenda, clientes e financeiro em um só painel.",
      },
      { property: "og:title", content: "Slotly — Agendamento online para qualquer negócio" },
      {
        property: "og:description",
        content:
          "Receba agendamentos 24/7, integre com Google Calendar e controle sua operação em um painel moderno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Splash,
});

function Splash() {
  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center text-center w-full max-w-sm">
        <div
          className="relative size-20 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Calendar className="size-10 text-primary-foreground" strokeWidth={2} />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Slotly
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          A agenda inteligente do seu negócio.
        </p>

        <div className="flex flex-col w-full gap-3">
          <Link to="/auth" className="btn-primary h-12 w-full justify-center text-base">
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-input bg-background px-4 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Criar minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}
