/**
 * deLIVREry - Embeddable Web Component
 * <delivrery-button />
 * Lightweight native Custom Element for digital menus and POS systems.
 */
class DelivreryButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const text = this.getAttribute('text') || 'Solicitar Entrega com deLIVREry';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        button {
          background-color: #10b981;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        button:hover {
          background-color: #059669;
        }
      </style>
      <button type="button">${text}</button>
    `;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('delivrery-button')) {
  customElements.define('delivrery-button', DelivreryButton);
}

export { DelivreryButton };
