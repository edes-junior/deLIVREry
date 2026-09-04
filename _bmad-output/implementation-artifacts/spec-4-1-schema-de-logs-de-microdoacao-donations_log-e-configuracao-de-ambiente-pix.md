---
title: 'Story 4.1: Schema de Logs de Microdoação (donations_log) e Configuração de Ambiente PIX'
type: 'feature'
created: '2026-09-04'
status: 'review'
baseline_commit: 'f635c48'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Para que o sistema descentralizado possa manter seus servidores e serviços operando de forma autônoma e colaborativa sem cobrar taxas dos trabalhadores ou dos lojistas, é necessário um mecanismo confiável de registro das intenções de apoio comunitário e uma estrutura flexível e segura para configurar a Chave PIX Estática da comunidade via variáveis de ambiente, sem expor dados sensíveis ou exigir recompilação.

**Approach:** Criar a migration SQL com a tabela `public.donations_log` protegida por RLS no PostgreSQL (Supabase), permitindo inserções anônimas ou vinculadas a usuários autenticados nos momentos de alívio e celebração operacional (*Delight Moments*). Implementar o módulo de configuração universal de PIX (`pix-config.ts`), tipos canônicos de doação, o serviço `DonationService` em Clean Architecture e atualizar as configurações de ambiente `.env` / `.env.example`.

## Boundaries & Constraints

- **Zero Intermediação Financeira (AD-2 / NFR-8):** O sistema não é instituição de pagamento nem custodia valores. O payload PIX é do tipo BR Code estático direto para a conta comunitária mantenedora.
- **Privacidade e Anonimato:** Doadores podem registrar doações anonimamente (`user_id = NULL`). Nenhuma informação bancária sensível é coletada ou gravada.
- **Validação de Momentos Disparadores:** O campo `trigger_moment` aceita exclusivamente momentos válidos:
  - `shift_completed` (Entregador: turno concluído com sucesso)
  - `level_up` (Entregador/Lojista: subida de nível no ranking de XP)
  - `emergency_matched` (Lojista: vaga de emergência aceita em < 5 min)
  - `rating_5_stars` (Lojista: avaliação recíproca com 5 estrelas)
  - `api_1000_requests` (Parceiro API: 1.000 requisições de sucesso)
  - `manual_donation` (Doação espontânea pelo rodapé ou página de transparência)
- **RLS Rigoroso (NFR-5):**
  - Permissão de `INSERT` para `anon` e `authenticated`.
  - Leituras públicas permitidas para agregação de transparência e consulta dos próprios registros pelo usuário.
- **Compatibilidade de Ambiente:** Leitura resiliente de variáveis em ambientes Node.js, Vite e navegador (`process.env` e `import.meta.env`).

## Acceptance Criteria

1. **Migration SQL DDL e RLS:**
   - Criação da tabela `public.donations_log` com `id UUID PRIMARY KEY`, `user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL`, `trigger_moment TEXT NOT NULL`, `suggested_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00`, e `copied_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
   - Restrição `CHECK (trigger_moment IN (...))` para momentos válidos.
   - Restrição `CHECK (suggested_amount >= 0.00)`.
   - Índices em `copied_at`, `trigger_moment` e `user_id`.
   - RLS habilitado e configurado para `anon` e `authenticated`.

2. **Módulo de Configuração PIX e Resiliência:**
   - Leitura de variáveis `PUBLIC_PIX_KEY`, `PUBLIC_PIX_RECIPIENT_NAME`, `PUBLIC_PIX_CITY` e `PUBLIC_PIX_BRCODE_PAYLOAD`.
   - Fallback para valores comunitários mockados e gerador padrão de BR Code no formato EMVCo PIX oficial do BACEN quando ausentes.

3. **Serviço de Domínio (`DonationService`):**
   - Método `getPixConfig()` retornando a configuração validada e payload BR Code pronto para cópia.
   - Método `logDonationCopy({ userId?, triggerMoment, suggestedAmount })` persistindo com sucesso e fallback defensivo sem quebrar o fluxo do usuário caso o Supabase esteja offline.
   - Método `getMonthlyDonationStats(month?, year?)` calculando total de intenções copiadas, valor estimado e contagem por momento disparador.

4. **Suíte de Testes Automatizados:**
   - Cobertura completa de cenários DDL, regras de negócio, fallback de variáveis de ambiente e persistência no Node.js test runner.

</frozen-after-approval>
