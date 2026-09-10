---
title: 'Story 4.4: Painel Público de Vitalidade e Sustentação Operacional da Praça'
type: 'feature-pivot'
created: '2026-09-08'
updated: '2026-09-09'
status: 'renegotiated-and-aligned'
renegotiation_reason: 'Decisão Humana e Party Mode: Não expor cifras monetárias em R$; substituir o foco redutor de servidor por sustentação da operação e esforço contínuo da equipe com objetivo visual de vitalidade operacional.'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — renegotiated on 2026-09-09 by user direction">

## Intent

**Problem:** Expor balancetes contábeis em Reais (R$) e restringir o discurso a "pagar custos de servidor" apequena o deLIVREry, transmitindo uma imagem de projeto amador ou vaquinha de faculdade. O apoio voluntário deve sustentar **toda a operação, o suporte humanizado e o esforço contínuo de desenvolvimento**. Além disso, expor valores em dinheiro cria distorções e desincentivos de arrecadação. A comunidade precisa de um **objetivo visual claro e convincente de sustentabilidade**, mas sem a exibição de cifras monetárias.

**Approach:**
1. **Modelo de Vitalidade Operacional (Sem Cifras em R$):**
   - Estruturar o indicador de sustentação mensal em faixas qualitativas de fôlego da rede:
     - 🟡 **Operação Básica:** Infraestrutura e conectividade essenciais mantidas.
     - 🟢 **Operação Saudável:** Suporte ativo, monitoramento e operação estável assegurados.
     - 🚀 **Evolução & Expansão Plena:** Melhorias contínuas, suporte dedicado e desenvolvimento acelerado da rede.
2. **Camada de Serviço (`DonationService`):**
   - Métodos calculando o percentual de autonomia do mês, o nível de vitalidade atingido e o status de Vitória Coletiva (`isGoalReached`), sem exigir que a camada de visualização exiba valores em R$.
3. **Componente Visual `TransparencyPanel.tsx` (Painel de Vitalidade da Praça):**
   - Barra de progresso visual estilizada e elegante (`vitality-progress-bar`) indicando o nível de fôlego operacional do mês corrente.
   - Texto de narrativa e missão comunitária: *"O deLIVREry não cobra comissões nem vende seus dados. Nossa operação é sustentada pelo compromisso de entregadores e lojistas livres."*
   - Banner de **Vitória Coletiva** (`collective-victory-banner`) ao atingir 100% de sustentação operacional no ciclo.
   - Botão de contribuição direta `[ 💚 Manter a Operação Livre ]` acionando o modal de doação (`triggerMoment = 'manual_donation'`) com alvos de toque $\ge 48\text{px}$ (NFR-9).
4. **Integração no PWA:**
   - Incorporar o painel no rodapé da aplicação `App.tsx` (visível no dashboard e telas públicas).
5. **Suíte de Testes Automatizados:**
   - Validar o cálculo percentual, transição entre faixas qualitativas, ativação de vitória coletiva e ausência de cifras monetárias na interface pública.

## Boundaries & Constraints

- **Ausência de Cifras Monetárias na UI Pública:** O componente não exibe valores em Reais (ex: "R$ 150,00" ou "R$ 85,00") para evitar contabilidade distorcida ou sensação de ganância/caridade.
- **Narrativa de Emancipação e Esforço:** A cópia enfatiza a autonomia do ecossistema e o trabalho da equipe, nunca caridade.
- **Acessibilidade e Performance (NFR-3, NFR-9):** Alvos de toque $\ge 48\text{px}$ e renderização instantânea com fallback defensivo.

## Acceptance Criteria

1. **Estrutura de Fôlego e Vitalidade Operacional:**
   - Cálculo de percentual de sustentação do mês mapeado em faixas visuais qualitativas:
     - $< 50\%$: Operação Básica.
     - $50\% - 99\%$: Operação Saudável.
     - $\ge 100\%$: Evolução & Expansão Plena (Vitória Coletiva).

2. **Componente Visual `TransparencyPanel.tsx`:**
   - Renderização da barra visual de progresso de vitalidade da comunidade.
   - Mensagem de transparência sobre o modelo de bem comum sem intermediários.
   - Quando $\ge 100\%$, renderizar banner de **Vitória Coletiva** celebrando a autonomia operacional plena do mês.
   - Botão de apoio `[ 💚 Manter a Operação Livre ]` acionando o modal PIX.

3. **Integração no PWA:**
   - Exibição harmoniosa no rodapé do PWA, respeitando o tema escuro/claro e sem poluir o fluxo de entregas.

4. **Suíte de Testes Automatizados:**
   - 100% de aprovação nos testes verificando níveis de vitalidade, ausência de valores em R$ na renderização e disparo de vitória coletiva.

</frozen-after-approval>
