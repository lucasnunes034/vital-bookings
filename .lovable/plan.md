# Plano de evolução — Slotly SaaS

Confirmei a análise anterior lendo `$slug.tsx`, `_authenticated/bookings.tsx`, `dashboard`, `onboarding`, cliente Supabase, middleware auth, `start.ts` e as 6 migrações existentes. Os problemas críticos identificados continuam válidos.

## Regras de execução

- **Uma tarefa por vez.** Só avanço com sua aprovação de cada entrega.
- **Não mexo em nada que já funciona** sem necessidade técnica.
- **Padrão visual e arquitetura preservados** (TanStack Start + Supabase + Tailwind v4 + shadcn).
- Ao fim de cada tarefa: revisão + validação (build/typecheck + teste do fluxo afetado) antes da próxima.

---

## FASE 1 — Produção (base sólida)

Objetivo: zero bugs críticos, dados seguros, CRUDs completos.

1. **Prevenção de conflito de horário no servidor** — hoje o insert de `bookings` não valida sobreposição; duas pessoas podem pegar o mesmo slot. Criar `EXCLUDE USING gist` + revalidação em `createServerFn`.
2. **Fuso horário correto** — padronizar tudo em UTC no banco, exibir no fuso da empresa (coluna `timezone` em `companies`).
3. **CRUD Serviços** (criar/editar/pausar/excluir + preço, duração, categoria).
4. **CRUD Profissionais** (dados, especialidades, status, vínculo de serviços).
5. **CRUD Horários** (disponibilidade semanal + intervalos + bloqueios pontuais).
6. **Cadastro de clientes com histórico** — tabela `customers` + vínculo em `bookings`, tela de listagem com histórico por cliente.
7. **Autoatendimento cliente** — link mágico por token para cancelar/reagendar sem login.
8. **Segurança dos agendamentos** — revisar RLS, rate limit no endpoint público, validação Zod server-side, prevenir enumeração de slugs.
9. **Performance** — índices faltantes (`bookings(company_id, start_at)`, `professional_id, start_at`), suspense + query keys corretas, remover N+1 no dashboard.

## FASE 2 — Experiência

10. Calendário estilo Google (dia/semana/mês, drag-to-reschedule).
11. Dashboard completo (KPIs, próximos agendamentos, ocupação, faturamento).
12. Filtros e busca (por cliente, serviço, profissional, período).
13. Upload de logo da empresa (Storage bucket).
14. Upload de foto dos profissionais.
15. QR Code do link público.
16. Refino UI/UX (empty states, skeletons, toasts, mobile).

## FASE 3 — SaaS

17. Google Calendar sync (App User Connector).
18. Notificações WhatsApp (via provedor + fila).
19. Notificações e-mail (Resend/SMTP + templates).
20. Planos e assinatura (Stripe).
21. Multiempresa por usuário.
22. Multiusuários por empresa.
23. Papéis e permissões (`user_roles` + `has_role`).

## FASE 4 — Diferenciais

24. Financeiro (receita, comissões, formas de pagamento).
25. Relatórios exportáveis (CSV/PDF).
26. PWA instalável + offline básico.
27. IA (sugestão de horários, resumo de cliente, no-show prediction).
28. Fidelidade (pontos, cupons).
29. Avaliações pós-atendimento.
30. Analytics de conversão do link público.

---

## Próxima tarefa (a executar agora, após aprovação)

**Tarefa 1.1 — Prevenção de conflito de horário (crítico)**

Escopo:

- Migração:
  - Adicionar extensão `btree_gist`.
  - Adicionar coluna gerada `time_range tstzrange` em `bookings`.
  - `EXCLUDE USING gist (professional_id WITH =, time_range WITH &&) WHERE (status IN ('pending','confirmed'))`.
  - Índice `bookings(company_id, start_at)` e `bookings(professional_id, start_at)`.
- Server function `createBooking` (nova, em `src/lib/bookings.functions.ts`):
  - Valida payload com Zod.
  - Recalcula `end_at` a partir de `service.duration_minutes` (não confia no cliente).
  - Insere via cliente publishable server-side + policy `TO anon` estreita, tratando erro `23P01` (exclusion violation) como "horário indisponível".
- Frontend `$slug.tsx`: substituir insert direto por chamada da server fn e mensagem amigável em caso de conflito.
- Não altero visual nem outros fluxos.

Critério de aceite:

- Duas requisições paralelas para o mesmo slot: apenas uma vence.
- Bookings existentes continuam funcionando (dashboard, lista, mudança de status).
- Build/typecheck ok.

Se aprovar, começo pela migração. Depois seguimos para 1.2 (timezone).
