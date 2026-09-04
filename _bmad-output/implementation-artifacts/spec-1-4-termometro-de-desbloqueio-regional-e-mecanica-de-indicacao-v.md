---
title: 'Story 1.4: Termômetro de Desbloqueio Regional e Mecânica de Indicação Viral'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '1e1e08400b8e8de91050371196bb391b96fefcf5'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Usuários cadastrados em regiões com quórum insuficiente (menos de 10 lojas e 50 entregadores) não possuem visibilidade do progresso de ativação de seu bairro nem mecanismos fáceis para engajar sua comunidade local, retardando o lançamento operacional.

**Approach:** Implementar o Termômetro de Desbloqueio Regional com barra de progresso visual de quórum (FR-13) no PWA e o Motor de Indicação Viral com compartilhamento em 1 clique (Web Share / Clipboard / WhatsApp), leitura de referral da URL e feedback tátil (FR-15).

## Boundaries & Constraints

**Always:**
- Regra de quórum hiperlocal inegociável: status `pre_launch` para regiões com < 10 lojistas ou < 50 entregadores; status `unlocked` (`is_unlocked = true`) quando ambos os quóruns forem atingidos (AD-8, FR-13).
- Cópia do link de indicação em 1 clique com toast feedback e suporte a Web Share API nativa nos dispositivos suportados (FR-15, NFR-9).
- Detecção automática de parâmetro `?ref=...` na URL da aplicação, persistindo no armazenamento local para pré-preenchimento no cadastro.
- Toda interface, mensagens, badges e compartilhamentos estritamente em `PT-BR`.
- Garantir alvos de toque $\ge 48\text{px}$ para compartilhamento em guidão de moto ou balcão de loja (NFR-9).

**Ask First:**
- Alterar as metas de quórum (10 lojistas e 50 entregadores) para valores diferentes.
- Introduzir dependências externas de encurtamento de URL ou provedores pagos de mensageria.

**Never:**
- Marcar uma micro-região como `unlocked` se não atingir ambos os limites mínimos de lojistas e motoboys.
- Bloquear a navegação do usuário caso a API de compartilhamento do navegador falhe (usar fallback para clipboard).
- Expor dados pessoais de outros usuários ao exibir o progresso do quórum coletivo do bairro.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Quórum em Pré-Lançamento | Bairro com 4 lojas e 20 motoboys | Exibe `pre_launch`, barra de lojistas em 40% (4/10), entregadores em 40% (20/50) | N/A |
| Quórum Total Atingido | Bairro com 12 lojas e 55 motoboys | Exibe badge "Região Ativa & Desbloqueada" com status `unlocked` e 100% nas barras | N/A |
| Compartilhamento com Web Share | Usuário clica em compartilhar em mobile com `navigator.share` | Dispara drawer nativo do OS com texto formatado e link `?ref=LIVRE-XXXXXX` | Fallback para clipboard se usuário cancelar ou falhar |
| Compartilhamento sem Web Share | Desktop / Navegador sem suporte a Web Share | Copia URL para a área de transferência com vibração haptic e exibe toast de confirmação | Fallback visual com exibição direta do link |
| Acesso via Link com Referral | Visitante entra com URL contendo `?ref=LIVRE-K9X2P4` | Salva código na sessão/storage e injeta no campo de indicação do formulário de cadastro | Se referral inválido ou inexistente, ignora sem travar fluxo |
| Bairro sem Nenhum Cadastro | Nova localidade consultada | Exibe contadores em 0/10 e 0/50 com 0% e incentivo para ser o primeiro cadastrado | Trata registro inexistente como 0 lojas e 0 motoboys |

</frozen-after-approval>

## Code Map

- `apps/pwa/src/quorum/quorum-service.ts` -- Serviço de consulta de quórum regional hiperlocal, cálculo de percentuais e status de ativação.
- `apps/pwa/src/referral/referral-service.ts` -- Motor de geração de link de indicação, orquestrador de Web Share / Clipboard / WhatsApp e leitor de referral da URL.
- `apps/pwa/src/components/quorum/RegionalQuorumThermometer.tsx` -- Componente visual responsivo do termômetro com barras de progresso duplas e badges de ativação.
- `apps/pwa/src/components/referral/ReferralCard.tsx` -- Cartão de compartilhamento viral em 1 clique com feedback visual e atalho direto para WhatsApp.
- `apps/pwa/src/App.tsx` -- Integração do termômetro e referral no dashboard, além do interceptador de `?ref=` na inicialização.
- `tests/quorum-referral.test.js` -- Suíte de testes automatizados cobrindo métricas de quórum, links de indicação, sanitização e casos de borda.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/src/quorum/quorum-service.ts` -- Implementar serviço de quórum com regras de cálculo percentual e metas 10/50 -- Viabilizar FR-13 e AD-8.
- [x] `apps/pwa/src/referral/referral-service.ts` -- Implementar serviço de indicação com Web Share, fallback de clipboard, haptic feedback e parser de URL -- Viabilizar FR-15 e NFR-9.
- [x] `apps/pwa/src/components/quorum/RegionalQuorumThermometer.tsx` -- Criar componente visual de termômetro de quórum com barras animadas e status pre_launch/unlocked -- Entregar visibilidade hiperlocal no PWA.
- [x] `apps/pwa/src/components/referral/ReferralCard.tsx` -- Criar componente de indicação viral com botão de 1 clique e atalho WhatsApp -- Alavancar crescimento orgânico da rede.
- [x] `apps/pwa/src/App.tsx` -- Integrar termômetro e referral card no dashboard principal do usuário logado e ler `?ref=` da URL -- Completar a experiência do Epic 1.
- [x] `tests/quorum-referral.test.js` -- Criar suíte de testes unitários para cálculo de quórum, montagem de links e cobertura da matriz I/O -- Garantir zero regressões.

**Acceptance Criteria:**
- Given um bairro com contadores abaixo de 10 lojas ou 50 entregadores, when exibido no termômetro, then deve apresentar o status `pre_launch` e indicar numericamente a quantidade atual vs a meta.
- Given um bairro com pelo menos 10 lojas e 50 entregadores, when exibido no termômetro, then deve apresentar o status `unlocked` com destaque de operação ativa.
- Given o usuário visualizando seu painel ou o termômetro, when ele clica no botão de indicação viral, then a URL com seu `referral_code` deve ser compartilhada ou copiada com feedback em toast.
- Given um novo usuário acessando a aplicação através de um link com `?ref=LIVRE-XXXXXX`, when ele abrir o formulário de cadastro, then o código de indicação deve estar automaticamente preenchido.

## Design Notes

- **Fórmula de Quórum**: Lojas % = `min(100, round((lojas / 10) * 100))`. Entregadores % = `min(100, round((motoboys / 50) * 100))`. Quórum Geral = `round((Lojas % + Entregadores %) / 2)`. Desbloqueado somente quando `Lojas >= 10 AND Entregadores >= 50`.
- **Haptic Feedback**: Chamada segura a `navigator.vibrate([40, 20, 40])` para dar sensação tátil de clique confirmado em smartphones.
- **WhatsApp Direct**: Link formatado `https://api.whatsapp.com/send?text=...` contendo mensagem apelativa com o link de indicação para disparo imediato para grupos locais.

## Verification

**Commands:**
- `npm test` -- expected: Execução de toda a suíte com 100% de testes passando, incluindo quórum e referral.
- `git status` -- expected: Mudanças rastreadas na branch `feat/story-1-4-termometro-indicacao`.

## Suggested Review Order

**Cálculo e Consulta de Quórum Hiperlocal (FR-13, AD-8)**

- Serviço de métricas de quórum com metas 10/50 e percentuais
  [`quorum-service.ts:36`](../../apps/pwa/src/quorum/quorum-service.ts#L36)

**Motor de Indicação Viral Multicanal (FR-15, NFR-9)**

- Geração de links, Web Share, clipboard com haptic feedback e parser de URL
  [`referral-service.ts:20`](../../apps/pwa/src/referral/referral-service.ts#L20)

**Componentes Visuais PWA**

- Componente do termômetro com barras de progresso duplas e status pre_launch/unlocked
  [`RegionalQuorumThermometer.tsx:20`](../../apps/pwa/src/components/quorum/RegionalQuorumThermometer.tsx#L20)

- Card de compartilhamento viral com 1 clique e atalho WhatsApp
  [`ReferralCard.tsx:16`](../../apps/pwa/src/components/referral/ReferralCard.tsx#L16)

**Integração no Fluxo da Aplicação**

- Auto-preenchimento de referral capturado no formulário de cadastro
  [`ProfileCompletionForm.tsx:68`](../../apps/pwa/src/components/profile/ProfileCompletionForm.tsx#L68)

- Integração completa de quórum e indicação no dashboard do usuário logado
  [`App.tsx:24`](../../apps/pwa/src/App.tsx#L24)

**Garantia de Qualidade e Casos de Borda**

- Suíte de testes automatizados cobrindo quórum, links e fallbacks
  [`quorum-referral.test.js:1`](../../tests/quorum-referral.test.js#L1)

