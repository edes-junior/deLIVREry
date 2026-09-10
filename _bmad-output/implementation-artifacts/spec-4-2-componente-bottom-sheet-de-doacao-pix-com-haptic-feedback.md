---
title: 'Story 4.2: Componente Bottom Sheet de Contribuição Operacional PIX com Haptic Feedback'
type: 'feature-pivot'
created: '2026-09-04'
updated: '2026-09-09'
status: 'renegotiated-and-aligned'
renegotiation_reason: 'Decisão Humana e Party Mode: Não expor valores monetários fixos; narrativa de sustentação da operação e esforço da equipe em vez de caridade/servidor.'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — renegotiated on 2026-09-09 by user direction">

## Intent

**Problem:** Modais intrusivos ou com apelos piegas de "caridade para pagar servidores" diminuem o respeito dos trabalhadores e lojistas pela ferramenta e desviam o foco da realidade: o deLIVREry é uma infraestrutura operacional profissional que exige dedicação, suporte humano e esforço de desenvolvimento para mantê-los livres de intermediários. Além disso, expor tabelas de valores pode soar comercial ou impor quantias. A solicitação deve ocorrer nos momentos em que o usuário experimenta a vitória da autonomia (*Delight Moments*), com narrativa convincente, sem caridade, sem expor cifras monetárias, e com cópia em 1 toque.

**Approach:** Adaptar o componente `DonationBottomSheet.tsx` no PWA utilizando design touch-friendly com alvos $\ge 48\text{px}$, animação de subida (*slide-up*), mensagens contextuais de vitória da logística livre adaptadas aos 5 momentos chave, botão direto de cópia da Chave PIX em 1 clique com vibração háptica (`navigator.vibrate([15, 50, 15])`), toast comemorativo de valor retido e botão descompromissado `[ Agora Não ]`.

## Boundaries & Constraints

- **Sem Caridade / Tom de Parceria e Independência:** A cópia deve deixar cristalino que a contribuição mantém a equipe, o suporte e a infraestrutura funcionando com qualidade, sem intermediários.
- **Não Exposição de Valores:** A interface não expõe cifras obrigatórias nem tabela de preços em Reais; o usuário é livre para contribuir com o valor que achar justo diretamente no app de seu banco.
- **Design Não-Bloqueante (Zero Dark Patterns):** É proibido qualquer contador regressivo, travamento de tela ou texto culpabilizante. O botão `[ Agora Não ]` fecha a tela imediatamente.
- **Ergonomia e Acessibilidade Mobile (NFR-9):** Alvos clicáveis $\ge 48 \times 48\text{px}$.
- **Feedback Tátil Resiliente:** Verificação defensiva de suporte a `navigator.vibrate`.

## Acceptance Criteria

1. **Renderização e Mensagens Contextuais nos 5 Delight Moments:**
   - O `DonationBottomSheet` deve renderizar título, ícone e narrativa convincente de soberania e sustentação operacional:
     - `shift_completed`: "Turno Concluído! 100% do Ganho Ficou com Você 🏍️💨" — destacando a ausência de comissões predatórias.
     - `level_up`: "Subiu de Nível na Operação! 🏆⭐"
     - `emergency_matched`: "Vaga de Emergência Salva sem Intermediários! ⏱️⚡"
     - `rating_5_stars`: "Avaliação 5 Estrelas Registrada! ⭐⭐⭐⭐⭐"
     - `api_1000_requests`: "1.000 Requisições sem Taxas de API! 🚀💻"
     - `manual_donation`: "Mantenha a Operação Livre e Independente! 💚🤝"
   - Botão visível e amigável `[ Agora Não ]`.

2. **Cópia da Chave PIX em 1 Clique e Haptic Feedback:**
   - Ao clicar em `[ 📋 Copiar Chave PIX ]`:
     - O payload da Chave PIX Estática é copiado para o clipboard (`navigator.clipboard.writeText`);
     - Vibração háptica física no dispositivo (`navigator.vibrate([15, 50, 15])`);
     - Toast na tela: *"Chave PIX copiada! Valeu por manter a logística livre e nas mãos de quem trabalha."*;
     - Ação registrada de forma anônima via `DonationService.logDonationCopy`.

3. **Integração e Testes Automatizados:**
   - Disparo contextual nos fluxos pós-turno e avaliação 5 estrelas.
   - Suíte de testes validando ergonomia $\ge 48\text{px}$, ausência de bloqueios punitivos e integridade de cópia.

</frozen-after-approval>
