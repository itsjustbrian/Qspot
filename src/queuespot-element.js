import { LitElement } from '../node_modules/@polymer/lit-element/lit-element.js';
export { html } from '../node_modules/@polymer/lit-element/lit-element.js';

export class QueuespotElement extends LitElement {

  propertyChanged(changedProps, propName) {
    return changedProps && changedProps.hasOwnProperty(propName);
  }

  $(id) {
    return this.shadowRoot.getElementById(id);
  }
}