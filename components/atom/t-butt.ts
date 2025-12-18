import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('t-butt')
export class TButt extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      font-size: 14px;
    }

    /* style for REGULAR BUTTON */
    button {
      min-width: 42px;
      min-height: 35px;
      font-size: inherit;
      margin: 2px;
      border-width: 0;
      padding: 1px 6px;
      font-family: sans-serif;
      background-color: var(--regular-button-color, #b0bec5);
      color: var(--on-regular-buton-color, black);
    }

    button.round {
      min-height: 42px;
    }

    button:not(:disabled) {
      cursor: pointer;
    }

    button:hover {
      box-shadow: 0px 0px 0px 2px var(--regular-button-color, #b0bec5);
    }
    button:active {
      box-shadow: 0px 0px 0px 4px var(--regular-button-color, #b0bec5);
    }

    /* Style for ICON button */
    button.icon {
      height: 31px;
      width: 42px;
      font-size: 1.125rem; /*= 18px;*/
    }

    /* Style for ROUND button */
    button.round {
      border-radius: 50%;
      width: 3.2rem;
      height: 3.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.875rem; /* = 30px*/
    }

    /* STYLE for the TOGGLE button */
    :host([toggle]) button {
      background-color: var(--toggle-button-color, lightgray);
      color: var(--on-toggle-button-color, black);
    }

    :host([toggle]) button:hover {
      box-shadow: 0px 0px 0px 2px var(--toggle-button-color, lightgray);
    }
    :host([toggle]) button:active {
      box-shadow: 0px 0px 0px 4px var(--toggle-button-color, lightgray);
    }

    :host([active]) button {
      background-color: var(--toggle-button-active-color, #431c5d);
      color: var(--on-toggle-button-active-color, white);
    }

    :host([active]) button:hover {
      box-shadow: 0px 0px 0px 2px var(--toggle-button-active-color, #431c5d);
    }

    :host([active]) button:active {
      box-shadow: 0px 0px 0px 4px var(--toggle-button-active-color, #431c5d);
    }

    /* Style for IMPORTANT button */
    button.important {
      background: var(--important-button, #dd2c00);
      color: var(--on-important-button, #fff);
    }

    button.important:hover {
      box-shadow: 0px 0px 0px 2px var(--important-button, #dd2c00);
    }
    button.important:active {
      box-shadow: 0px 0px 0px 4px var(--important-button, #dd2c00);
    }

    /* STYLE for the SPECIAL button */
    .special:hover {
      box-shadow: 0px 0px 0px 2px var(--important-button, #dd2c00);
    }
    .special:active {
      z-index: 1;
      box-shadow: 0px 0px 0px 4px var(--important-button, #dd2c00);
    }

    @media (min-width: 576px) {
      /* ie width is GREATER than 576px */
      /* NOT ON MOBILE-PHONES */
      button {
        min-width: 12px;
        min-height: 12px;
      }

      button.round {
        min-height: 12px;
        width: 37px;
        height: 37px;
        font-size: 1.3125rem; /* = 21px */
      }
    }
  `;

  @property({ type: Boolean }) icon = false;
  @property({ type: Boolean }) round = false;
  @property({ type: Boolean }) important = false;
  @property({ type: Boolean }) special = false;
  @property({ type: Boolean }) toggle = false;
  @property({ type: Boolean, reflect: true }) active = false;

  private _getClasses() {
    const classes = [];
    if (this.toggle) {
      classes.push('toggle');
    }
    if (this.icon) {
      classes.push('icon');
    }
    if (this.round) {
      classes.push('round');
    }
    if (this.important) {
      classes.push('important');
    }
    if (this.special) {
      classes.push('special');
    }
    return classes.join(' ');
  }

  private _handleClick() {
    if (!this.toggle) {
      // Dispatch event for regular button action
      this.dispatchEvent(new CustomEvent('butt-clicked', { bubbles: true, composed: true }));
    } else if (this.toggle) {
      this.active = !this.active;
      this.dispatchEvent(
        new CustomEvent('butt-toggled', {
          detail: { active: this.active },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  render() {
    return html`<button class="${this._getClasses()}" @click=${this._handleClick}>
      <slot></slot>
    </button>`;
  }
}
