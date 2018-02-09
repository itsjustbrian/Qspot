import { LitElement } from '../node_modules/@polymer/lit-element/lit-element.js';
export { html } from '../node_modules/lit-html/lib/lit-extended.js';

export class QueuespotElement extends LitElement {

  _flushProperties() {
    super._flushProperties();

    this.renderCallback(this.__dataOld);
  }

  // Optionally overrided
  renderCallback(oldProps) { }

  propertyHasChanged(propertyName) {
    return this.__dataOld.hasOwnProperty(propertyName);
  }

  $(id) {
    return this.shadowRoot.getElementById(id);
  }
}