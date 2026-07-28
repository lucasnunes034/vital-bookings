
# Relatório Completo — Slotly SaaS

Panorama atual do produto após as Fases 1–3 implementadas, com auditoria de funcionalidades, bugs conhecidos/potenciais e sugestões de evolução. Nenhum código será alterado antes da sua aprovação.

---

## 1. Funcionalidades já implementadas

### Autenticação & Onboarding
- Login/cadastro por e-mail + senha (Zod validado) e Google OAuth.
- Recuperação de senha via link mágico.
- Onboarding guiado para criação da empresa (nome, segmento, timezone).
- Rotas protegidas via `_authenticated/route.tsx` com redirect para `/auth`.

### Painel Administrativo
- **Dashboard**: KPIs do dia, próximos agendamentos, lembretes pendentes (WhatsApp).
- **Agendamentos**: filtros por status/profissional/serviço, modal de detalhes, reagendamento com validação de conflitos, cancelamento com motivo.
- **Calendário visual (dia/semana)**: drag-and-drop, sugestão automática de horários alternativos em conflito, undo (8s), histórico de reagendamentos (`booking_reschedule_history`), click-to-create em slot livre, filtros em tempo real.
- **Clientes (CRM)**: agregação por telefone/e-mail, histórico, KPIs de fidelidade (frequência, ticket, última visita).
- **Serviços / Profissionais / Disponibilidade / Intervalos**: CRUD completo com fotos, ordenação, ativo/inativo.
- **Configurações**:
  - Empresa (nome, slug, contato, endereço, redes sociais, galeria).
  - Horário de funcionamento.
  - Formas de pagamento presencial (dinheiro, PIX, débito, crédito).
  - Templates de mensagem WhatsApp (confirmação, reagendamento, cancelamento, lembretes 24h/1h).
  - Aparência (White Label): logo, favicon, banner, cores, tema (claro/escuro/auto), fonte, templates por segmento, preview em tempo real e validação de contraste WCAG.

### Página Pública (`/$slug`)
- Hero compacto com banner, logo, tagline, avaliação média.
- Lista de serviços e profissionais com foto.
- Endereço com Google Maps, redes sociais, horário de funcionamento.
- Fluxo de agendamento em etapas (serviço → profissional → data/hora → dados → forma de pagamento).
- Avaliações dos clientes (após atendimento).
- Botão compartilhar com QR Code dinâmico (cores do tema).

### Autoatendimento do Cliente
- Link mágico `/manage/$token` para cancelar ou reagendar sem login.
- RPCs seguras `get_booking_by_token`, `cancel_booking_by_token`, `reschedule_booking_by_token`.

### Notificações WhatsApp
- Templates personalizáveis por empresa.
- Botão manual (`wa.me`) na tela de agendamentos.
- Widget de lembretes pendentes (24h/1h) no dashboard.

### Pagamentos (arquitetura pronta, presencial ativo)
- Registro de método escolhido pelo cliente no agendamento.
- Tabelas `payment_settings`, `payment_intents` e interface `PaymentProvider` prontas para Stripe/Pix online (desativado por padrão).

### Infra & Qualidade
- Timezone consistente (UTC no DB, local via `src/lib/timezone.ts`).
- Exclusion constraint no Postgres previne overlap de bookings.
- RLS endurecida em todas as tabelas + GRANTs explícitos.
- Mapeamento de erros específico (`src/lib/booking-errors.ts`).
- QueryClient com `staleTime`/`gcTime` calibrados.
- Design system 100% baseado em CSS variables + tokens semânticos.

---

## 2. Bugs & problemas a corrigir

### Alta severidade
1. **Sem verificação de e-mail obrigatória**: `signUp` cria conta sem confirmar identidade — permite spam e reset de senha para e-mails alheios.
2. **Timezone da empresa não editável na UI**: definido no onboarding, sem tela para ajustar depois. Empresas que migram de fuso ficam com horários incorretos.
3. **Lembretes WhatsApp são manuais**: o widget mostra pendências mas depende do admin clicar; sem cron/automação, "reminder_24h_sent_at" nunca é preenchido de forma confiável.
4. **Sem paginação em listas grandes**: `bookings`, `customers` e `calendar` carregam com `limit` fixo — empresas com histórico longo perdem dados na UI.
5. **Google OAuth redirect_uri = `window.location.origin`**: se o usuário abrir `/auth` de um subdomínio custom não configurado no provider, o login falha silenciosamente.

### Média severidade
6. **Página pública sem tratamento de slug inexistente**: retorna erro genérico em vez de 404 estilizado.
7. **Upload de mídia sem limite/validação de tamanho** consistente no cliente (só no bucket).
8. **`manage_token` exposto na URL** sem expiração — se vazar (screenshot, e-mail encaminhado) permite cancelar indefinidamente.
9. **Sem rate limit em RPCs públicas** (`get_booking_by_token`, criação de bookings) — vetor de brute force / spam.
10. **Reviews não têm moderação**: cliente pode publicar review ofensivo sem aprovação do dono.
11. **Preview de aparência não persiste em refresh** até salvar — comportamento esperado, mas sem aviso claro.
12. **Sem indicador de "carregando" em transições de rota** — TanStack pendingComponent não configurado.

### Baixa severidade
13. **Landing SaaS (`/`)** ainda tem cores hardcoded (mockup decorativo) — intencional, mas inconsistente com a auditoria White Label.
14. **Sem SEO por empresa**: `head()` da rota `$slug` não inclui `og:image` do banner da empresa.
15. **Sitemap** não lista páginas públicas das empresas ativas.
16. **Sem dark mode toggle** no painel autenticado (só via config da empresa).
17. **Mensagens WhatsApp** sem preview antes de abrir o `wa.me`.
18. **Sem confirmação ao excluir** serviço/profissional com agendamentos futuros.

---

## 3. Sugestões de novas funcionalidades

### Curto prazo — alto valor comercial
- **Automação real de lembretes** (cron via `pg_cron` + endpoint `/api/public/cron/reminders`) enviando via WhatsApp Business API ou provedor SMS.
- **Multi-usuário por empresa** (`user_roles`: owner, gerente, profissional, recepção) com permissões granulares.
- **Bloqueio de agenda / folgas pontuais** por profissional (férias, feriados).
- **Recorrência de agendamentos** (semanal/quinzenal/mensal).
- **Lista de espera** quando horário desejado está ocupado.
- **Check-in / status "em atendimento" / "concluído"** para operação do dia.

### Médio prazo — diferenciação
- **Comissões por profissional** e relatório de repasse.
- **Relatórios financeiros e operacionais** (faturamento, no-show rate, ocupação por profissional, serviços mais rentáveis) com exportação CSV/PDF.
- **Pacotes e assinaturas** (ex.: "5 cortes por mês") com controle de saldo.
- **Cupons e promoções** (percentual, valor fixo, primeira visita).
- **Programa de fidelidade** (pontos, cashback, aniversariante do mês).
- **Integração com Google Calendar / Apple Calendar** (2-way sync).
- **Confirmação automática pelo cliente via link** (reduz no-show).
- **App PWA instalável** para o painel + notificações push.

### Longo prazo — plataforma
- **Ativação de pagamentos online** (Stripe/Mercado Pago/Pix) com split e antecipação.
- **Marketplace público** (`slotly.app/descobrir`) para clientes acharem empresas por cidade/segmento.
- **Multi-unidades/filiais** dentro da mesma conta.
- **API pública + Webhooks** para integrações externas.
- **Planos SaaS com billing** (Free / Pro / Business) usando Stripe Billing.
- **App mobile nativo** (React Native) para profissionais.
- **IA**: sugestão de horários ótimos, previsão de no-show, chatbot de agendamento no WhatsApp/Instagram DM.

### UX / Polimento
- **Onboarding interativo** com checklist ("adicione seu primeiro serviço", "convide um profissional").
- **Empty states** ilustrados em todas as listas.
- **Skeleton loaders** em vez de spinners.
- **Comandos ⌘K** (command palette) para navegar rápido.
- **Tour guiado** no primeiro acesso.
- **Feedback in-app** (widget de sugestões).

---

## 4. Priorização sugerida

### Alta (bloqueia produção séria)
- Automação de lembretes WhatsApp (cron real).
- Verificação de e-mail no cadastro.
- Editor de timezone nas configurações da empresa.
- Multi-usuário + roles.
- Rate limit + expiração do `manage_token`.
- Paginação em listas grandes.

### Média (competitividade)
- Bloqueio de agenda, recorrência, lista de espera.
- Relatórios financeiros e comissões.
- Integração Google Calendar.
- Confirmação do cliente por link (anti no-show).
- Moderação de reviews + 404 estilizado.

### Baixa (polimento e crescimento)
- Marketplace público + SEO por empresa.
- PWA + push.
- Pacotes/assinaturas, cupons, fidelidade.
- Command palette, onboarding checklist, skeletons.
- Billing SaaS (planos pagos).

---

## 5. Próximo passo recomendado

Sugiro atacar em sequência:
1. **Automação de lembretes WhatsApp** (fecha a promessa da Fase 3).
2. **Multi-usuário com roles** (destrava vendas para empresas com equipe).
3. **Bloqueio de agenda + recorrência** (features mais pedidas em SaaS de agendamento).

Me confirme qual bloco atacamos primeiro (ou reordene à vontade) que eu abro um plano de implementação detalhado só dessa fase.
