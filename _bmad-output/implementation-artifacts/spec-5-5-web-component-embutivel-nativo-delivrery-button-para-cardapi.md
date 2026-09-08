---
title: 'Story 5.5: Web Component Embutível Nativo (<delivrery-button />) para Cardápios e PDVs'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: 'db5eab74bc0bc1db87e79c2937748805f884ee87'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Plataformas externas (cardápios digitais, PDVs na nuvem, sites de restaurantes e portais municipais) enfrentam dificuldades técnicas e atrito de desenvolvimento para integrar chamadas de entrega descentralizadas diretamente em seus layouts sem carregar bibliotecas pesadas ou sofrer com conflitos de CSS.

**Approach:** Desenvolver e empacotar o Web Component nativo `<delivrery-button />` (`@delivrery/embed-widget`) baseado na especificação padrão Custom Elements v1 com Shadow DOM encapsulado, tempo de montagem ultrarrápido $< 50\text{ms}$ (NFR-4), zero dependências externas em runtime e alvos de toque $\ge 48\text{px}$ (NFR-9). O componente oferece modos interativos de operação (`modal`, `redirect`, `event`), suporte a temas (`dark`/`light`), emissão de eventos CustomEvent e uma aba de demonstração/playground no Developer Portal.

## Boundaries & Constraints

**Always:**
- O componente deve ser implementado em JavaScript padrão (Custom Elements v1) com Shadow DOM aberto (`mode: 'open'`) para completo encapsulamento de estilos e isolamento de CSS.
- Não possuir dependências externas de runtime (Vanilla JS puro, zero bundling pesado ou frameworks proprietários necessários para o consumidor final, NFR-4).
- O tempo de montagem e renderização inicial (`connectedCallback`) deve ser inferior a 50 milissegundos (NFR-4).
- Respeitar critérios de acessibilidade e ergonomia com alvos de toque mínimos de $48\text{px}$ no botão e controles do modal (NFR-9).
- Suportar atributos declarativos padronizados: `client-id`, `city-id`, `neighborhood-id`, `store-name`, `label`/`text`, `theme` (`dark`|`light`), `mode` (`modal`|`redirect`|`event`) e `base-rate`.
- Disparar eventos DOM customizados para permitir observabilidade pelo integrador: `delivrery:click`, `delivrery:submit`, `delivrery:close`.

**Ask First:**
- Inclusão de scripts ou dependências de terceiros no bundle distribuído do widget.
- Modificação dos nomes dos atributos ou eventos customizados padronizados.

**Never:**
- Nunca vazar seletores de estilo que possam quebrar o CSS da página hospedeira do cardápio digital parceiro.
- Nunca travar ou bloquear a renderização da página hospedeira caso o endpoint do deLIVREry demore para responder.
- Nunca exigir login de sessão Supabase dentro do iframe/widget do parceiro para operações headless delegadas via `client-id`.

## I/O & Edge-Case Matrix

| Cenário | Atributos / Ação | Saída Esperada / Comportamento | Tratamento de Erro |
|---|---|---|---|
| Renderização Padrão (Happy Path) | `<delivrery-button label="Pedir Motoboy Livre" theme="dark" />` | Botão estilizado renderizado no Shadow DOM com altura $\ge 48\text{px}$, texto e ícone em $< 50\text{ms}$ | N/A |
| Modo Modal Interativo (`mode="modal"`) | Clique no botão com `store-name="Pizzaria Bella"` e `city-id="sao_paulo"` | Abre modal sobreposto no Shadow DOM exibindo dados da entrega, valor estimado e botão de confirmação | Botão de fechar (✕) ou tecla Escape fecham o modal |
| Disparo de Custom Events | Clique ou submissão no componente | Dispara eventos `delivrery:click` e `delivrery:submit` no elemento host com `event.detail` contendo metadados | Capturável via `addEventListener` padrão |
| Modo Redirecionamento (`mode="redirect"`) | Clique com `mode="redirect"` | Redireciona navegador para o PWA oficial (`https://delivrery.app.br/?city=...&store=...`) | Fallback com target `_blank` |
| Atributos Ausentes ou Incompletos | `<delivrery-button />` sem atributos definidos | Aplica valores padrão seguros (`label="Pedir Entrega com deLIVREry"`, tema escuro, modo modal) | Degradação graciosa |
| Reatividade de Atributos | Modificação de `label` ou `theme` via `element.setAttribute(...)` | `attributeChangedCallback` re-renderiza o componente dinamicamente sem recarregar a página | N/A |

</frozen-after-approval>

## Code Map

- `packages/embed-widget/src/delivrery-button.js` -- Implementação completa do Custom Element `<delivrery-button />` com Shadow DOM, estilos encapsulados, ciclo de vida, modal embutido e disparo de eventos.
- `packages/embed-widget/package.json` -- Configurações do pacote `@delivrery/embed-widget` com pontos de entrada e exportações ESM.
- `apps/pwa/src/components/developers/EmbedWidgetPlayground.tsx` -- Componente interativo de demonstração no Developer Portal com preview ao vivo do botão, simulador de temas e gerador de código HTML `<script>`.
- `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Integração da nova aba "Web Component (<delivrery-button />)" no menu de desenvolvedores.
- `tests/embed-widget.test.js` -- Suíte de testes automatizados validando registro do Custom Element, atributos observados, Shadow DOM, alvos de toque e emissão de CustomEvents.

## Tasks & Acceptance

**Execution:**
- [x] `packages/embed-widget/src/delivrery-button.js` -- Implementar o Custom Element `<delivrery-button>` com Shadow DOM, modos (`modal`, `redirect`, `event`), suporte a temas e eventos customizados.
- [x] `apps/pwa/src/components/developers/EmbedWidgetPlayground.tsx` -- Criar playground interativo no Portal do Desenvolvedor com preview em tempo real e gerador de snippet de integração.
- [x] `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Adicionar aba "Widget Embutível" para desenvolvedores experimentarem e copiarem o código do `<delivrery-button>`.
- [x] `tests/embed-widget.test.js` -- Criar suíte de testes automatizados com cobertura para todos os cenários da matriz de I/O, atributos observados e acessibilidade NFR-9.

**Acceptance Criteria:**
- Given a inclusão da tag `<delivrery-button>` em qualquer página HTML ou cardápio digital, when o script do widget for carregado, then o elemento deve renderizar via Shadow DOM em menos de 50ms com estilos isolados da página hospedeira.
- Given o clique no botão em modo modal (`mode="modal"`), when acionado, then um modal embutido de solicitação rápida deve ser exibido permitindo confirmação ou cancelamento sem dependências de frameworks.
- Given uma aplicação hospedeira monitorando eventos, when o botão for acionado ou a entrega solicitada, then eventos `delivrery:click` e `delivrery:submit` com detalhes da entrega devem ser disparados pelo Custom Element.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Design Notes

- **Estrutura do Shadow DOM:**
  ```html
  <delivrery-button client-id="dlv_..." city-id="sao_paulo" store-name="Burger Rock">
    #shadow-root (open)
      <style> ... </style>
      <button class="delivrery-btn" type="button">
        <span class="icon">🛵</span>
        <span class="text">Pedir Motoboy Livre</span>
      </button>
      <div class="delivrery-modal-backdrop"> ... </div>
  </delivrery-button>
  ```
- **Acessibilidade e Ergonomia (NFR-9):**
  - Botão principal com `min-height: 48px`, `padding: 12px 20px` e `border-radius: 8px`.
  - Estados de foco com anel visível (`outline: 2px solid #38bdf8; outline-offset: 2px;`).
  - Suporte a navegação por teclado (Enter e Espaço acionam o clique; Escape fecha o modal).

## Verification

**Commands:**
- `npm test` -- expected: Todas as suítes passam, incluindo a nova `tests/embed-widget.test.js`.
- `node --experimental-strip-types --test tests/embed-widget.test.js` -- expected: 100% de aprovação nos testes da Story 5.5.
- `git status` -- expected: Árvore de trabalho íntegra.

**Manual checks (if no CLI):**
- Abrir o playground do widget no Developer Portal e testar a alternância entre temas (Dark/Light) e modos (Modal/Redirect).
- Inspecionar a árvore de elementos no DevTools para confirmar isolamento pelo Shadow DOM.

## Suggested Review Order

1. `packages/embed-widget/package.json` -- Configuração do pacote com exportação ESM pura.
2. `packages/embed-widget/src/delivrery-button.js` -- Web Component nativo `<delivrery-button>` com Shadow DOM, atributos e eventos customizados.
3. `apps/pwa/src/components/developers/EmbedWidgetPlayground.tsx` -- Componente interativo de configuração, preview ao vivo e gerador de snippet.
4. `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Integração da nova aba `widget` no portal de desenvolvedores.
5. `tests/embed-widget.test.js` -- Suíte de 15 testes cobrindo todo o ciclo de vida, NFR-4 (< 50ms) e NFR-9 (>= 48px).

