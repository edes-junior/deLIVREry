---
title: 'Story 3.4: Painel Visual do Balizador Regional no PWA e Landing Pages'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'ca03ee0'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entregadores e lojistas precisam de transparência visual imediata sobre as medianas ($P_{med}$), pisos ($P_{min}$) e tetos ($P_{max}$) praticados em seu bairro, além de uma maneira rápida e sem atrito para preencher valores justos ao criar vagas ou formular propostas, sem necessidade de cálculos manuais ou digitação excessiva no celular.

**Approach:** Desenvolver o componente de interface `RegionalPricingWidget` no PWA e integrá-lo ao painel principal (`App.tsx`) e ao modal de publicação de vagas (`JobPublishModal.tsx`). O componente exibe a mediana em destaque tipográfico, chips de limites com cores semânticas, seletor de modal de transporte touch-friendly ($\ge 48\text{px}$ - NFR-9), badge indicativo de consolidação regional (com contador de amostras e de outliers expurgados) e o botão interativo "[💡 Sugerir Preço de Mercado]" com feedback tátil (haptic feedback) para autopreenchimento instantâneo em 1 toque.

## Boundaries & Constraints

**Always:**
- Componente responsivo com tipografia moderna, contraste adequado e alvos de toque com altura mínima de 48px (`minHeight: 48px` - NFR-9).
- Exibição destacada da mediana ($P_{med}$) acompanhada dos limites mínimo ($P_{min}$) e máximo ($P_{max}$) tanto para a Diária quanto para a Taxa por Entrega.
- Filtro interativo por modal de transporte (`Todos`, `Moto`, `Bicicleta`, `E-Bike`).
- Indicação clara e transparente do nível de dados: "Consolidado no Bairro" ou "Em consolidação (Referência Municipal)".
- Botão "[Sugerir Preço de Mercado]" em formulários de vaga/proposta que autopreenche os campos numéricos com $P_{med}$.
- Emissão de vibração tátil (*haptic feedback*) em dispositivos compatíveis ao acionar o preenchimento de preços.

**Ask First:**
- Ocultar o balizador para usuários não autenticados nas landing pages.
- Alterar a paleta de cores ou disposição dos chips de preços.

**Never:**
- Nunca bloquear a renderização da interface se o balizador regional estiver carregando (usar skeleton ou loaders discretos).
- Nunca permitir que o botão de sugestão de preços preencha valores negativos ou NaN.
- Nunca quebrar o layout em telas estreitas de smartphones (mínimo de 320px de largura suportado).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bairro com Amostra Consolidada | Bairro com $\ge 10$ turnos nos últimos 14 dias | Exibe badge verde "Consolidado no Bairro", valores de $P_{med}$, $P_{min}$, $P_{max}$ e contador de outliers | N/A |
| Bairro em Consolidação | Bairro com $< 10$ turnos | Exibe badge âmbar "Em Consolidação - Referência Municipal" com valores da cidade | N/A |
| Clique em "Sugerir Preço de Mercado" | Lojista clica no botão com valores do balizador carregados | Preenche automaticamente campos de Diária e Taxa com $P_{med}$, vibra celular e exibe confirmação visual | Se valores forem 0, usa tarifa base de segurança |
| Alternância de Modal no Widget | Usuário toca no chip "Bicicleta" | Atualiza as métricas filtrando exclusivamente para o modal de ciclistas | Se não houver amostra específica, mantém fallback com indicação |
| Dispositivo sem Suporte a Vibração | `navigator.vibrate` indisponível no navegador | Ação de preenchimento executada normalmente sem lançar erro | Fallback seguro sem exceção |

</frozen-after-approval>

## Code Map

- `apps/pwa/src/components/pricing/RegionalPricingWidget.tsx` -- Componente visual do Balizador Regional com seletor de modais, destaque de $P_{med}$ e chips de $P_{min}/P_{max}$.
- `apps/pwa/src/components/jobs/JobPublishModal.tsx` -- Integração do botão "[💡 Sugerir Preço de Mercado]" e preview compacto do balizador.
- `apps/pwa/src/App.tsx` -- Incorporação do `RegionalPricingWidget` no feed de controle de entregadores e lojistas.
- `tests/pricing-widget-ui.test.js` -- Suíte de testes automatizados com Node test runner validando formatação de moeda, cálculo de sugestão de valores, alvos touch $\ge 48\text{px}$ e tolerância a falhas.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/src/components/pricing/RegionalPricingWidget.tsx` -- Criar o componente visual reutilizável com estados de loading, seletor de modal, destaque de quartis e botão de autopreenchimento.
- [x] `apps/pwa/src/components/jobs/JobPublishModal.tsx` -- Integrar o balizador com preenchimento em 1 toque no formulário de publicação de vagas.
- [x] `apps/pwa/src/App.tsx` -- Adicionar o widget de preços regionais no painel do usuário autenticado.
- [x] `tests/pricing-widget-ui.test.js` -- Implementar e executar suíte de testes com 100% de aprovação.

**Acceptance Criteria:**
- Given a tela de publicação de vagas ou o dashboard do PWA, when o bairro for selecionado, then o `RegionalPricingWidget` deve exibir $P_{med}$ em destaque com chips de $P_{min}$ e $P_{max}$.
- Given o lojista clicando em [💡 Sugerir Preço de Mercado], when o botão for pressionado, then os campos de diária e taxa devem ser preenchidos instantaneamente com os valores da mediana do bairro.
- Given qualquer botão ou seletor interativo do balizador, when renderizado, then deve respeitar a dimensão mínima de 48px para facilidade de toque no guidão.

## Verification

**Commands:**
- `npm test` -- expected: Todos os testes anteriores + novos testes da Story 3.4 passando com 100% de sucesso.
- `git status` -- expected: Branch `feat/story-3-4-pricing-widget-ui` com código versionado.
