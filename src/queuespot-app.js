import { LitElement, html } from '../node_modules/@polymer/lit-element/lit-element.js';

class QueuespotApp extends LitElement {

  static get properties() {
    return {
      foo: String,
      whales: Number
    };
  }

  constructor() {
    super();
    this.foo = 'foo';
  }

  ready() {
    this.addEventListener('click', async (e) => {
      this.whales++;
      await this.nextRendered;
      this.dispatchEvent(new CustomEvent('whales', { detail: { whales: this.whales } }));
    });
    super.ready();
  }

  render({ foo, whales }) {
    return html`
      <style>
        :host {
          display: block;
        }
      </style>
      <h4>Foo: ${foo}</h4>
      <div>whales: ${'🐳'.repeat(whales)}</div>
      <slot></slot>
    `;
  }

}
customElements.define('queuespot-app', QueuespotApp);