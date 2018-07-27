import { LitElement } from '@polymer/lit-element/lit-element.js';
export { html } from '@polymer/lit-element/lit-element.js';

export class QueuespotElement extends LitElement {

  $(id) {
    return this.shadowRoot.getElementById(id);
  }
}
