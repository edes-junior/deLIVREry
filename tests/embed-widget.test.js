import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Setup de DOM Environment Mocks para execução segura em Node.js
class MockShadowRoot {
  constructor() {
    this.innerHTML = '';
  }

  querySelector(selector) {
    // Implementação mock simples para os seletores usados no teste
    if (this.innerHTML.includes(selector.replace('.', '').replace('#', ''))) {
      const listeners = {};
      return {
        addEventListener: (event, handler) => {
          listeners[event] = handler;
        },
        dispatchEvent: (event) => {
          if (listeners[event.type]) {
            listeners[event.type](event);
          }
        },
        _listeners: listeners
      };
    }
    return null;
  }
}

class MockCustomElementsRegistry {
  constructor() {
    this.registry = new Map();
  }

  define(name, constructor) {
    this.registry.set(name, constructor);
  }

  get(name) {
    return this.registry.get(name);
  }
}

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.composed = !!init.composed;
    this.detail = init.detail || {};
  }
}

class MockHTMLElement {
  constructor() {
    this._attributes = new Map();
    this._eventListeners = {};
    this.shadowRoot = null;
  }

  attachShadow(options) {
    this.shadowRoot = new MockShadowRoot();
    this.shadowRootMode = options.mode;
    return this.shadowRoot;
  }

  getAttribute(name) {
    return this._attributes.get(name) || null;
  }

  setAttribute(name, value) {
    const oldValue = this._attributes.get(name) || null;
    this._attributes.set(name, String(value));
    if (typeof this.attributeChangedCallback === 'function') {
      this.attributeChangedCallback(name, oldValue, String(value));
    }
  }

  removeAttribute(name) {
    const oldValue = this._attributes.get(name) || null;
    this._attributes.delete(name);
    if (typeof this.attributeChangedCallback === 'function') {
      this.attributeChangedCallback(name, oldValue, null);
    }
  }

  addEventListener(event, handler) {
    if (!this._eventListeners[event]) {
      this._eventListeners[event] = [];
    }
    this._eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this._eventListeners[event]) {
      this._eventListeners[event] = this._eventListeners[event].filter(h => h !== handler);
    }
  }

  dispatchEvent(event) {
    const handlers = this._eventListeners[event.type] || [];
    for (const handler of handlers) {
      handler(event);
    }
    return true;
  }
}

// Configura globals antes de importar o componente
globalThis.HTMLElement = MockHTMLElement;
globalThis.CustomEvent = MockCustomEvent;
globalThis.customElements = new MockCustomElementsRegistry();
if (typeof navigator !== 'undefined') {
  try {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => true,
      configurable: true,
      writable: true
    });
  } catch (e) {}
} else {
  globalThis.navigator = { vibrate: () => true };
}

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.window = {
  open: () => {}
};

// Importa o Web Component nativo
const { DelivreryButton } = await import('../packages/embed-widget/src/delivrery-button.js');

describe('Story 5.5: Web Component Embutível Nativo (<delivrery-button />) para Cardápios e PDVs', () => {
  const packageJsonPath = path.join(process.cwd(), 'packages/embed-widget/package.json');
  const widgetSrcPath = path.join(process.cwd(), 'packages/embed-widget/src/delivrery-button.js');
  const playgroundPath = path.join(process.cwd(), 'apps/pwa/src/components/developers/EmbedWidgetPlayground.tsx');
  const portalPath = path.join(process.cwd(), 'apps/pwa/src/components/developers/DeveloperPortal.tsx');

  describe('Cenário 1: Empacotamento do Widget (@delivrery/embed-widget) e Integridade de Código', () => {
    it('deve verificar o arquivo packages/embed-widget/package.json com metadados corretos', () => {
      assert.ok(fs.existsSync(packageJsonPath), 'package.json do embed-widget deve existir');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      assert.strictEqual(pkg.name, '@delivrery/embed-widget');
      assert.strictEqual(pkg.main, 'src/delivrery-button.js');
      assert.ok(pkg.description.includes('Web Component nativo'));
    });

    it('deve garantir que delivrery-button.js é Vanilla JS puro sem anotações de tipo TypeScript', () => {
      assert.ok(fs.existsSync(widgetSrcPath), 'delivrery-button.js deve existir');
      const content = fs.readFileSync(widgetSrcPath, 'utf8');

      // Zero tipagem TS no arquivo JS distribuído
      assert.ok(!content.includes(': string'), 'Não deve ter anotação de tipo : string');
      assert.ok(!content.includes('import type'), 'Não deve ter import type');
      assert.ok(content.includes('class DelivreryButton extends HTMLElement'), 'Deve estender HTMLElement padrão');
      assert.ok(content.includes("customElements.define('delivrery-button', DelivreryButton)"), 'Deve registrar custom element');
    });
  });

  describe('Cenário 2: Ciclo de Vida do Custom Element, Shadow DOM e Performance NFR-4', () => {
    it('deve registrar a tag delivrery-button no registro de Custom Elements', () => {
      const registered = globalThis.customElements.get('delivrery-button');
      assert.ok(registered, 'O elemento delivrery-button deve estar registrado');
      assert.strictEqual(registered, DelivreryButton);
    });

    it('deve declarar os atributos observados obrigatórios', () => {
      const observed = DelivreryButton.observedAttributes;
      assert.ok(Array.isArray(observed));
      assert.ok(observed.includes('client-id'));
      assert.ok(observed.includes('city-id'));
      assert.ok(observed.includes('neighborhood-id'));
      assert.ok(observed.includes('store-name'));
      assert.ok(observed.includes('label'));
      assert.ok(observed.includes('theme'));
      assert.ok(observed.includes('mode'));
      assert.ok(observed.includes('base-rate'));
    });

    it('deve anexar Shadow DOM aberto com tempo de montagem < 50ms (NFR-4)', () => {
      const btn = new DelivreryButton();
      assert.ok(btn.shadowRoot, 'Deve anexar shadowRoot');
      assert.strictEqual(btn.shadowRootMode, 'open', 'Shadow DOM deve ser open para acessibilidade e inspeção');

      btn.connectedCallback();
      assert.ok(btn.renderDurationMs < 50, `Tempo de renderização (${btn.renderDurationMs}ms) deve ser < 50ms (NFR-4)`);
      assert.ok(btn.shadowRoot.innerHTML.includes('delivrery-btn'), 'Deve renderizar botão no shadowRoot');
    });
  });

  describe('Cenário 3: Ergonomia Touch (NFR-9) e Isolamento de Estilos no Shadow DOM', () => {
    it('deve isolar estilos com :host e garantir alvos de toque >= 48px (NFR-9)', () => {
      const btn = new DelivreryButton();
      btn.connectedCallback();
      const html = btn.shadowRoot.innerHTML;

      // Isolamento
      assert.ok(html.includes(':host {'), 'Deve conter seletores isolados no Shadow DOM via :host');
      // Ergonomia NFR-9
      assert.ok(html.includes('min-height: 48px;'), 'Botão principal deve possuir min-height de 48px');
      assert.ok(html.includes('outline: 3px solid #38bdf8;'), 'Deve possuir anel de foco visível para acessibilidade');
    });

    it('deve renderizar botões de confirmação e cancelamento com min-height >= 48px', () => {
      const btn = new DelivreryButton();
      btn._openModal();
      const html = btn.shadowRoot.innerHTML;

      assert.ok(html.includes('.action-btn {'), 'Deve conter estilos para action-btn');
      assert.ok(html.includes('min-height: 48px;'), 'Botões de ação do modal devem respeitar NFR-9');
      assert.ok(html.includes('min-width: 48px;'), 'Botão de fechar do modal deve respeitar largura mínima de toque');
    });
  });

  describe('Cenário 4: Modos de Operação (modal, redirect, event) e Disparo de CustomEvents', () => {
    it('deve disparar evento delivrery:click com metadados ao acionar o botão', () => {
      const btn = new DelivreryButton();
      btn.setAttribute('client-id', 'dlv_test_123');
      btn.setAttribute('city-id', 'curitiba');
      btn.setAttribute('store-name', 'Churrascaria Paraná');
      btn.setAttribute('base-rate', '18.50');
      btn.connectedCallback();

      let clickEventFired = false;
      let eventDetail = null;

      btn.addEventListener('delivrery:click', (e) => {
        clickEventFired = true;
        eventDetail = e.detail;
      });

      btn._handleClick({ preventDefault: () => {} });

      assert.strictEqual(clickEventFired, true, 'Deve disparar evento delivrery:click');
      assert.strictEqual(eventDetail.clientId, 'dlv_test_123');
      assert.strictEqual(eventDetail.cityId, 'curitiba');
      assert.strictEqual(eventDetail.storeName, 'Churrascaria Paraná');
      assert.strictEqual(eventDetail.baseRate, 18.50);
    });

    it('deve disparar evento delivrery:submit ao confirmar pedido no modo modal', () => {
      const btn = new DelivreryButton();
      btn.setAttribute('city-id', 'sao_paulo');
      btn.setAttribute('store-name', 'Hamburgueria Central');
      btn.connectedCallback();
      btn._openModal();

      let submitEventFired = false;
      let submitDetail = null;

      btn.addEventListener('delivrery:submit', (e) => {
        submitEventFired = true;
        submitDetail = e.detail;
      });

      btn._handleSubmit({ preventDefault: () => {} });

      assert.strictEqual(submitEventFired, true, 'Deve disparar evento delivrery:submit');
      assert.strictEqual(submitDetail.storeName, 'Hamburgueria Central');
      assert.ok(submitDetail.orderId.startsWith('ord_'), 'Deve gerar ID único de pedido');
      assert.ok(submitDetail.requestedAt, 'Deve incluir timestamp ISO da requisição');
    });

    it('deve suportar modo redirect acionando abertura de URL externa', () => {
      let openedUrl = null;
      globalThis.window.open = (url) => {
        openedUrl = url;
      };

      const btn = new DelivreryButton();
      btn.setAttribute('mode', 'redirect');
      btn.setAttribute('city-id', 'belo_horizonte');
      btn.setAttribute('store-name', 'Pão de Queijo Mania');
      btn.connectedCallback();

      btn._handleClick({ preventDefault: () => {} });

      assert.ok(openedUrl, 'Deve chamar window.open');
      assert.ok(openedUrl.includes('https://delivrery.app.br/?city=belo_horizonte'));
      assert.ok(openedUrl.includes('store=P%C3%A3o%20de%20Queijo%20Mania'));
    });

    it('deve suportar fechamento de modal e disparo de delivrery:close', () => {
      const btn = new DelivreryButton();
      btn.connectedCallback();
      btn._openModal();
      assert.strictEqual(btn._isModalOpen, true);

      let closeEventFired = false;
      btn.addEventListener('delivrery:close', () => {
        closeEventFired = true;
      });

      btn._closeModal();
      assert.strictEqual(btn._isModalOpen, false);
      assert.strictEqual(closeEventFired, true, 'Deve emitir evento delivrery:close');
    });
  });

  describe('Cenário 5: Reatividade de Atributos e Temas Visuais (Dark / Light)', () => {
    it('deve re-renderizar estilos e cores ao alternar entre tema escuro e claro', () => {
      const btn = new DelivreryButton();
      btn.setAttribute('theme', 'dark');
      btn.connectedCallback();
      assert.ok(btn.shadowRoot.innerHTML.includes('#059669'), 'Tema escuro deve usar cor verde esmeralda 600');

      btn.setAttribute('theme', 'light');
      assert.ok(btn.shadowRoot.innerHTML.includes('#10b981'), 'Tema claro deve usar cor verde 500');
    });

    it('deve aplicar valores padrão graciosamente caso atributos sejam omitidos', () => {
      const btn = new DelivreryButton();
      btn.connectedCallback();

      assert.strictEqual(btn.label, 'Pedir Motoboy com deLIVREry');
      assert.strictEqual(btn.theme, 'dark');
      assert.strictEqual(btn.mode, 'modal');
      assert.strictEqual(btn.cityId, 'sao_paulo');
      assert.strictEqual(btn.baseRate, null);
    });
  });

  describe('Cenário 6: Validação do Playground e Integração no Developer Portal', () => {
    it('deve verificar a integridade do EmbedWidgetPlayground.tsx', () => {
      assert.ok(fs.existsSync(playgroundPath), 'EmbedWidgetPlayground.tsx deve existir');
      const content = fs.readFileSync(playgroundPath, 'utf8');

      assert.ok(content.includes('export const EmbedWidgetPlayground'), 'Deve exportar o componente');
      assert.ok(content.includes('<delivrery-button'), 'Deve incluir a tag do web component no JSX');
      assert.ok(content.includes('delivrery:click'), 'Deve escutar delivrery:click');
      assert.ok(content.includes('delivrery:submit'), 'Deve escutar delivrery:submit');
      assert.ok(content.includes('delivrery:close'), 'Deve escutar delivrery:close');
      assert.ok(content.includes('minHeight: \'48px\''), 'Controles devem respeitar NFR-9');
      assert.ok(content.includes('Copiar Snippet HTML'), 'Deve permitir copiar o snippet de integração');
    });

    it('deve verificar a aba widget integrada no DeveloperPortal.tsx', () => {
      assert.ok(fs.existsSync(portalPath), 'DeveloperPortal.tsx deve existir');
      const content = fs.readFileSync(portalPath, 'utf8');

      assert.ok(content.includes("import { EmbedWidgetPlayground } from './EmbedWidgetPlayground.tsx'"), 'Deve importar o playground');
      assert.ok(content.includes("'widget'"), 'Deve incluir a opção widget no estado activeTab');
      assert.ok(content.includes('<EmbedWidgetPlayground />'), 'Deve renderizar o playground na aba widget');
      assert.ok(content.includes('Web Component') && content.includes('delivrery-button'), 'Deve rotular o botão de aba');
    });
  });
});
