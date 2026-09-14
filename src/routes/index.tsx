import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  Users,
  Clock,
  BarChart3,
  Zap,
  Shield,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Scissors,
  Stethoscope,
  PawPrint,
  Dumbbell,
  Wrench,
  Palette,
  Star,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

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
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-xl bg-background/70">
      <div className="container-page flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight">Slotly</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
          <a href="#how" className="hover:text-foreground transition-colors">Como funciona</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="btn-ghost hidden sm:inline-flex">Entrar</Link>
          <Link to="/cadastro" className="btn-primary">
            Começar grátis <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <div className="relative size-7 rounded-lg overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Calendar className="size-4 text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} aria-hidden />
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden />
      <div className="container-page relative pt-24 pb-24 md:pt-32 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" style={{ color: "var(--brand)" }} />
            Feito para qualquer negócio de horário marcado
          </div>
          <h1 className="font-display mt-6 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            <span className="text-gradient">A agenda inteligente</span>
            <br />
            do seu negócio.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Receba agendamentos 24/7, evite conflitos com Google Calendar, controle profissionais,
            clientes e financeiro — tudo em um painel moderno e rápido.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/cadastro" className="btn-primary">
              Começar gratuitamente <ArrowRight className="size-4" />
            </Link>
            <a href="#how" className="btn-ghost">Ver como funciona</a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sem cartão de crédito · Configure em 5 minutos
          </p>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute -inset-x-20 -top-10 h-64 blur-3xl opacity-40 pointer-events-none" style={{ background: "var(--gradient-brand)" }} aria-hidden />
      <div className="relative surface-card overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-yellow-400/70" />
          <span className="size-2.5 rounded-full bg-green-400/70" />
          <span className="ml-3 text-xs text-muted-foreground">app.slotly.com/agenda</span>
        </div>
        <div className="grid md:grid-cols-[220px_1fr]">
          <aside className="hidden md:block border-r border-border p-4 space-y-1 text-sm">
            {[
              { icon: Calendar, label: "Agenda", active: true },
              { icon: Users, label: "Clientes" },
              { icon: Clock, label: "Serviços" },
              { icon: BarChart3, label: "Financeiro" },
              { icon: Shield, label: "Configurações" },
            ].map(({ icon: Icon, label, active }) => (
              <div key={label} className={"flex items-center gap-2 rounded-lg px-3 py-2 " + (active ? "bg-accent text-foreground" : "text-muted-foreground")}>
                <Icon className="size-4" /> {label}
              </div>
            ))}
          </aside>
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Quinta, 5 de Dezembro</h3>
                <p className="text-xs text-muted-foreground">3 profissionais · 12 agendamentos</p>
              </div>
              <div className="flex gap-1 text-xs">
                {["Dia", "Semana", "Mês"].map((t, i) => (
                  <span key={t} className={"px-2.5 py-1 rounded-md border " + (i === 0 ? "border-border bg-accent" : "border-transparent text-muted-foreground")}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[
                { time: "09:00", name: "Ana Ribeiro", service: "Consulta inicial", color: "var(--brand)" },
                { time: "10:30", name: "Lucas Prado", service: "Retorno", color: "oklch(0.72 0.14 305)" },
                { time: "13:00", name: "Marina Souza", service: "Sessão premium", color: "oklch(0.7 0.15 200)" },
                { time: "15:15", name: "Rafael Dias", service: "Avaliação", color: "oklch(0.72 0.16 145)" },
              ].map((a) => (
                <div key={a.time} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
                  <span className="text-xs text-muted-foreground w-12">{a.time}</span>
                  <span className="h-9 w-1 rounded-full" style={{ background: a.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.service}</p>
                  </div>
                  <span className="hidden sm:inline-flex text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                    Confirmado
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoStrip() {
  const items = [
    { icon: Scissors, label: "Barbearias" },
    { icon: Palette, label: "Salões & Estética" },
    { icon: Stethoscope, label: "Clínicas" },
    { icon: PawPrint, label: "Pet shops" },
    { icon: Dumbbell, label: "Personal & Estúdios" },
    { icon: Wrench, label: "Oficinas" },
  ];
  return (
    <section className="border-y border-border/60 bg-surface/30">
      <div className="container-page py-10">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
          Um sistema para qualquer negócio de horário marcado
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center justify-items-center text-muted-foreground">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: Calendar, title: "Agenda estilo Google Calendar", desc: "Visão diária, semanal e mensal. Arraste para reagendar, confirme e cancele com um clique." },
    { icon: Zap, title: "Integração Google Calendar", desc: "Cada profissional conecta sua conta. Zero conflito, sincronização em tempo real." },
    { icon: Users, title: "Clientes com histórico", desc: "Ficha completa, observações, valor gasto e frequência para você conhecer sua base." },
    { icon: BarChart3, title: "Financeiro & relatórios", desc: "Receita diária, semanal, mensal. Exporte em Excel ou PDF quando quiser." },
    { icon: Shield, title: "Multi-empresa seguro", desc: "Cada empresa isolada com Row Level Security. Escala para milhares sem misturar dados." },
    { icon: Sparkles, title: "Assistente de IA", desc: "Pergunte no chat: quanto faturei, quais serviços vendem mais, quem não volta há 30 dias." },
  ];
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="container-page">
        <SectionHeading eyebrow="Recursos" title="Tudo que você precisa para operar." subtitle="Do primeiro agendamento à gestão financeira. Sem gambiarra, sem planilha." />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="surface-card p-6 group transition-colors" style={{ transition: "border-color 200ms ease" }}>
              <div className="inline-flex size-10 items-center justify-center rounded-xl mb-4" style={{ background: "linear-gradient(135deg, oklch(0.62 0.16 275 / 0.2), oklch(0.72 0.14 305 / 0.2))", border: "1px solid oklch(0.62 0.16 275 / 0.3)" }}>
                <f.icon className="size-5" style={{ color: "var(--brand)" }} />
              </div>
              <h3 className="font-display font-semibold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Crie sua conta", desc: "Cadastre sua empresa em minutos. Escolha logo, cores e horários." },
    { n: "02", title: "Configure serviços e equipe", desc: "Adicione profissionais, serviços, preços e integre o Google Calendar." },
    { n: "03", title: "Compartilhe seu link", desc: "Clientes agendam sozinhos, 24/7. Você recebe confirmações automáticas." },
    { n: "04", title: "Acompanhe pelo painel", desc: "Dashboard, financeiro e IA para tomar decisões com dados reais." },
  ];
  return (
    <section id="how" className="py-24 md:py-32 border-t border-border/60">
      <div className="container-page">
        <SectionHeading eyebrow="Como funciona" title="Do zero ao primeiro agendamento em minutos." />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="surface-card p-6 relative overflow-hidden">
              <span className="font-display text-5xl font-semibold text-brand-gradient opacity-90">{s.n}</span>
              <h3 className="font-display font-semibold mt-3 mb-1.5">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: "Starter", price: "R$ 0", period: "/mês", desc: "Para começar e testar sem fricção.", features: ["1 profissional", "Até 50 agendamentos/mês", "Página de agendamento pública", "Suporte por email"], cta: "Começar grátis", highlight: false },
    { name: "Pro", price: "R$ 79", period: "/mês", desc: "Para negócios que querem crescer.", features: ["Até 10 profissionais", "Agendamentos ilimitados", "Integração Google Calendar", "Lembretes por WhatsApp", "Relatórios e exportações"], cta: "Assinar Pro", highlight: true },
    { name: "Premium", price: "R$ 199", period: "/mês", desc: "Operação avançada com IA.", features: ["Profissionais ilimitados", "Multi-unidades", "Assistente de IA", "Domínio personalizado", "Suporte prioritário"], cta: "Falar com vendas", highlight: false },
  ];
  return (
    <section id="pricing" className="py-24 md:py-32 border-t border-border/60">
      <div className="container-page">
        <SectionHeading eyebrow="Planos" title="Preços simples. Sem surpresa." subtitle="Comece grátis. Faça upgrade quando quiser. Cancele quando quiser." />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={"relative surface-card p-7 flex flex-col " + (p.highlight ? "ring-1 ring-primary/40" : "")} style={p.highlight ? { boxShadow: "var(--shadow-glow), var(--shadow-card)" } : undefined}>
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-widest uppercase px-3 py-1 rounded-full text-white" style={{ background: "var(--gradient-brand)" }}>
                  Mais popular
                </span>
              )}
              <h3 className="font-display font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <Link to="/cadastro" className={p.highlight ? "btn-primary mt-6" : "btn-ghost mt-6"}>
                {p.cta}
              </Link>
              <ul className="mt-7 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { quote: "Dobrei o número de agendamentos no primeiro mês. Meus clientes marcam de madrugada, no domingo, e eu só acordo com a agenda cheia.", name: "Diego Martins", role: "Barbearia Norte" },
    { quote: "Trocamos 3 sistemas por um só. A integração com Google Calendar dos profissionais acabou com os choques de horário.", name: "Dra. Camila Ferraz", role: "Clínica Odontológica" },
    { quote: "O painel é lindo e rápido. A IA me mostrou que perdia clientes depois de 45 dias sem retorno — mudei meu marketing por causa disso.", name: "Renata Alves", role: "Estúdio de Estética" },
  ];
  return (
    <section className="py-24 md:py-32 border-t border-border/60">
      <div className="container-page">
        <SectionHeading eyebrow="Depoimentos" title="Times que agendam com Slotly." />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.name} className="surface-card p-6">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" style={{ color: "var(--brand)" }} />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed">"{t.quote}"</blockquote>
              <figcaption className="mt-5 text-sm">
                <div className="font-medium">{t.name}</div>
                <div className="text-muted-foreground text-xs">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    { q: "Serve para qualquer tipo de negócio?", a: "Sim. Barbearias, salões, clínicas, estúdios, pet shops, oficinas, consultórios — qualquer negócio que trabalhe com horário marcado." },
    { q: "Preciso instalar algo?", a: "Não. É 100% web, funciona no computador e celular. Também dá pra instalar como app (PWA)." },
    { q: "Como funciona a integração com Google Calendar?", a: "Cada profissional conecta a própria conta Google. Os agendamentos viram eventos automaticamente e o sistema consulta a disponibilidade antes de aceitar novas reservas." },
    { q: "Meus dados ficam seguros?", a: "Sim. Cada empresa é isolada com Row Level Security. Autenticação JWT e criptografia em trânsito e em repouso." },
    { q: "Posso cancelar quando quiser?", a: "Claro. Sem multa, sem burocracia. Você mantém acesso até o fim do ciclo pago." },
    { q: "Tem versão grátis?", a: "Tem. O plano Starter é gratuito para sempre, com limites que já resolvem quem está começando." },
  ];
  return (
    <section id="faq" className="py-24 md:py-32 border-t border-border/60">
      <div className="container-page max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Perguntas frequentes." />
        <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-surface/40 overflow-hidden">
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 hover:bg-accent/40 transition-colors" aria-expanded={open}>
        <span className="font-medium text-sm md:text-base">{q}</span>
        <ChevronDown className={"size-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && <div className="px-5 pb-5 -mt-1 text-sm text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
}

function CTA() {
  return (
    <section className="py-24 md:py-32 border-t border-border/60">
      <div className="container-page">
        <div className="relative overflow-hidden surface-card p-10 md:p-16 text-center">
          <div className="absolute inset-0 pointer-events-none opacity-60" style={{ background: "var(--gradient-hero)" }} aria-hidden />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-gradient">
              Sua próxima agenda cheia começa aqui.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Teste grátis. Sem cartão. Migre da planilha (ou do concorrente) em 5 minutos.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/cadastro" className="btn-primary">
                Começar gratuitamente <ArrowRight className="size-4" />
              </Link>
              <Link to="/auth" className="btn-ghost">Entrar</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-12">
      <div className="container-page flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-sm font-semibold">Slotly</span>
          <span className="text-xs text-muted-foreground ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Recursos</a>
          <a href="#pricing" className="hover:text-foreground">Planos</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="font-display mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-gradient">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
