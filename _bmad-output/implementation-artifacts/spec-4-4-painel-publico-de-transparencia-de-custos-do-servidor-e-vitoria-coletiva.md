---
title: 'Story 4.4: Painel Público de Transparência de Custos do Servidor e Vitória Coletiva'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '316f6bb'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Para consolidar a confiança e o engajamento da comunidade de entregadores, lojistas e desenvolvedores em um modelo sustentável sem taxas predatórias, a plataforma precisa de transparência radical sobre os custos reais mensais de infraestrutura (servidores Supabase, Web Push FCM e hospedagem estática). Sem essa visibilidade, os usuários não sabem se a plataforma necessita de apoio ou se as metas comunitárias já foram atingidas. Quando a meta de 100% dos custos for coberta pela arrecadação voluntária do mês, a comunidade deve celebrar junta essa conquista através de um banner de *Vitória Coletiva*.

**Approach:**
1. **Configuração e Provedor de Custos Mensais:**
   - Adicionar em `apps/pwa/src/donations/pix-config.ts` e `apps/pwa/src/donations/types.ts` a estrutura formal de custos mensais (`ServerCostBreakdown`), permitindo customização via variável de ambiente `PUBLIC_MONTHLY_SERVER_COST_BRL` (default: R$ 150,00) e detalhamento por serviço:
     - Supabase Database & Auth: R$ 85,00
     - Hospedagem Edge / CDN: R$ 45,00
     - Domínio e Infraestrutura DNS: R$ 20,00
2. **Camada de Serviço (`DonationService`):**
   - Implementar `DonationService.getTransparencyReport()`, calculando o percentual de cobertura da meta, valor restante para 100%, status de Vitória Coletiva (`isGoalReached`), total arrecadado, contagem de apoiadores únicos e breakdown de custos.
3. **Componente Visual `TransparencyPanel.tsx`:**
   - Criar `apps/pwa/src/components/donations/TransparencyPanel.tsx` exibindo:
     - Termômetro visual com barra de progresso em porcentagem (`transparency-progress-bar`).
     - Valores monetários: Total arrecadado vs. Meta de custo mensal.
     - Indicador de apoiadores únicos e mês vigente.
     - Detalhamento expansível de custos da infraestrutura.
     - Banner comemorativo de **Vitória Coletiva** (`collective-victory-banner`) ao atingir $\ge 100\%$.
     - Botão de contribuição direta `[ 💚 Apoiar Manutenção do Servidor ]` acionando o modal de doação (`triggerMoment = 'manual_donation'`) com alvos de toque $\ge 48\text{px}$ (NFR-9).
4. **Integração no PWA:**
   - Incorporar o `TransparencyPanel` no rodapé da aplicação `App.tsx` (visível para usuários autenticados e na tela pública de login/boas-vindas).
5. **Suíte de Testes Automatizados:**
   - Criar `tests/transparency-panel-collective-victory.test.js` validando o cálculo de porcentagens, thresholds de vitória coletiva ($\ge 100\%$), detalhamento de custos, renderização dos atributos `data-testid` e ergonomia touch $\ge 48\text{px}$.

## Boundaries & Constraints

- **Transparência Sem Exposição de Dados Pessoais (NFR-5):** O painel expõe apenas dados consolidados e contagens agregadas da view `monthly_donation_stats` ou fallback in-memory, sem jamais revelar nomes ou identificadores de usuários não autorizados.
- **Desempenho e Resiliência (NFR-3):** Renderização instantânea com fallback seguro para garantir carregamento $< 100\text{ms}$ mesmo offline ou sem conectividade com o backend Supabase.
- **Acessibilidade Touch (NFR-9):** Alvos de toque com altura mínima de 48px nos botões de apoio e alternância de detalhes.
- **Frugalidade Comunitária (NFR-8):** Alinhamento estrito ao compromisso de ausência de intermediação bancária ou taxas operacionais sobre entregas.

## Acceptance Criteria

1. **Estrutura de Dados e Configuração de Custos:**
   - Tipagem e configuração de meta de custos de infraestrutura no módulo de doações (`ServerCostBreakdown`, `TransparencyReport`).
   - Suporte a fallback padrão de R$ 150,00 e detalhamento por componentes (Supabase, Hosting, Domínio/DNS).

2. **Cálculo da Cobertura e Status de Vitória Coletiva:**
   - Se arrecadação total $\ge$ meta de custos, `isGoalReached = true` e `percentage >= 100%`.
   - Se arrecadação total $<$ meta de custos, `isGoalReached = false` e calcula exatamente o valor monetário restante para atingir a meta.

3. **Componente Visual `TransparencyPanel.tsx`:**
   - Barra de progresso visual estilizada representando o termômetro de cobertura.
   - Quando `percentage >= 100%`, renderizar banner de **Vitória Coletiva** comemorando a autossuficiência do ecossistema.
   - Botão touch-friendly `[ 💚 Apoiar Manutenção do Servidor ]` com altura $\ge 48\text{px}$ que aciona o modal PIX.
   - Seção expansível com a discriminação dos custos operacionais.

4. **Integração no App PWA:**
   - Exibição no rodapé da tela inicial não-autenticada e no dashboard de entregadores/lojistas.

5. **Suíte de Testes Automatizados:**
   - 100% de aprovação nos testes cobrindo cálculos de meta, vitória coletiva, componentes UI e NFRs.

</frozen-after-approval>
