import { LitElement } from '../node_modules/@polymer/lit-element/lit-element.js';
export { html } from '../node_modules/@polymer/lit-element/lit-element.js';

export class QueuespotElement extends LitElement {

  didRender(changedProps) {
    this.changedProps = changedProps;
  }

  propertyChanged(propName) {
    return this.changedProps && this.changedProps.hasOwnProperty(propName);
  }

  $(id) {
    return this.shadowRoot.getElementById(id);
  }
}
