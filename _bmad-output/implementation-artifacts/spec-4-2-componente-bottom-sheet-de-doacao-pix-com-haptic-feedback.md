---
title: 'Story 4.2: Componente Bottom Sheet de Doação PIX com Haptic Feedback nos 5 Delight Moments'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'd7dbc0b'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Modais intrusivos, com contadores regressivos ou que bloqueiam a operação de trabalhadores de entrega e lojistas geram atrito e rejeição. Por outro lado, pedidos de apoio descontextualizados em páginas isoladas possuem conversão quase nula. Para garantir sustentabilidade comunitária sem intermediários, o sistema precisa acionar o pedido de contribuição voluntária de forma suave e afetuosa nos momentos exatos em que o usuário acabou de experimentar um alívio ou conquista operacional (*Delight Moments*), permitindo a cópia do código PIX em 1 toque com sensação tátil física.

**Approach:** Criar o componente `DonationBottomSheet.tsx` no PWA utilizando design touch-friendly com alvos $\ge 48\text{px}$, animação de subida (*slide-up*), mensagens contextuais de celebração adaptadas aos 5 momentos chave, seleção rápida de valores em chips (`[ R$ 2,00 ]`, `[ R$ 5,00 ]`, `[ R$ 10,00 ]`, `[ Outro ]`), botão de cópia do BR Code em 1 clique com vibração háptica (`navigator.vibrate([15, 50, 15])`), toast de confirmação e botão descompromissado `[ Agora Não ]`.

## Boundaries & Constraints

- **Design Não-Bloqueante (Zero Dark Patterns):** É estritamente proibido incluir contadores regressivos de espera para fechar o modal, botões de recusa com texto culpabilizante ("shaming copy") ou desabilitar o botão `[ Agora Não ]`.
- **Ergonomia e Acessibilidade Mobile (NFR-9):** Todos os elementos clicáveis (chips, botões de ação e fechar) devem possuir dimensões mínimas de $48 \times 48\text{px}$.
- **Feedback Tátil Resiliente:** A chamada `navigator.vibrate([15, 50, 15])` deve possuir verificação defensiva de suporte para não quebrar em navegadores de desktop ou dispositivos iOS sem suporte à API de vibração.
- **Integração de Domínio:** A ação de cópia deve acionar de forma assíncrona `DonationService.logDonationCopy({ userId, triggerMoment, suggestedAmount })`.

## Acceptance Criteria

1. **Renderização e Mensagens Contextuais nos 5 Delight Moments:**
   - O `DonationBottomSheet` deve renderizar título, ícone e mensagem personalizados para:
     - `shift_completed`: "Turno Concluído com Sucesso! 🏍️💨"
     - `level_up`: "Subiu de Nível na Comunidade! 🏆⭐"
     - `emergency_matched`: "Vaga de Emergência Atendida a Tempo! ⏱️⚡"
     - `rating_5_stars`: "Avaliação 5 Estrelas Registrada! ⭐⭐⭐⭐⭐"
     - `api_1000_requests`: "Marca de 1.000 Requisições Atingida! 🚀💻"
     - `manual_donation`: "Apoie a Sustentabilidade do deLIVREry! 💚🤝"
   - O modal deve possuir botão explícito `[ Agora Não ]` que o fecha imediatamente.

2. **Seleção de Valores Sugeridos:**
   - Chips de valor pré-configurados: `R$ 2,00`, `R$ 5,00` (selecionado por padrão), `R$ 10,00` e opção para digitar `Outro Valor`.
   - Ao alterar o chip, o valor no botão de cópia e o payload do PIX devem ser atualizados instantaneamente.

3. **Cópia do BR Code em 1 Clique e Haptic Feedback:**
   - Ao clicar em `[ 📋 Copiar Código PIX ]`:
     - O payload BR Code correspondente deve ser gravado na área de transferência (`navigator.clipboard.writeText`);
     - O dispositivo deve emitir vibração háptica em padrão duplo (`navigator.vibrate([15, 50, 15])`);
     - Um toast de feedback deve ser exibido na tela ("Código PIX copiado! Cole no seu app de banco.");
     - A intenção de apoio deve ser registrada via `DonationService.logDonationCopy`.

4. **Integração nos Fluxos Principais do PWA:**
   - Disparo do modal no `JobRatingModal.tsx` quando uma nota 5 estrelas for atribuída.
   - Disparo no `JobCard.tsx` / `App.tsx` quando um turno for marcado como concluído.
   - Botão de acesso direto no cabeçalho ou rodapé para apoio voluntário espontâneo (`manual_donation`).

5. **Suíte de Testes Automatizados:**
   - Teste de dimensões $\ge 48\text{px}$, mensagens dos momentos disparadores, seleção de valores, vibração háptica, cópia e persistência do log.

</frozen-after-approval>
