import { LitElement, html } from '@polymer/lit-element';

class SnackBar extends LitElement {
  render() {
    return html`
      <style>
      :host {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 12px;
        background-color: black;
        color: white;
        text-align: center;
        will-change: transform;
        transform: translate3d(0, 100%, 0);
        transition-property: visibility, transform;
        transition-duration: 0.2s;
        visibility: hidden;
      }
      :host([active]) {
        visibility: visible;
        transform: translate3d(0, 0, 0);
      }
      @media (min-width: 460px) {
        :host {
          width: 320px;
          margin: auto;
        }
      }
    </style>
    <slot></slot>
    `;
  }

  static get properties() {
    return {
      active: { type: Boolean }
    };
  }
}

window.customElements.define('snack-bar', SnackBar);
