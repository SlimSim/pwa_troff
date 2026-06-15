import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('t-butt')
export class TButt extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      font-size: 14px;
    }

    /* base styles for both <button> and link-mode <a> */
    .base {
      min-width: 42px;
      min-height: 35px;
      font-size: inherit;
      margin: 2px;
      border-width: 0;
      border-radius: var(--button-border-radius);
      padding: 1px 6px;
      font-family: sans-serif;
      background-color: var(--regular-button-color, #b0bec5);
      color: var(--on-regular-buton-color, black);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* link-specific resets */
    a.base {
      text-decoration: none;
      color: var(--on-regular-buton-color, black);
    }

    .base.slim {
      min-width: 20px;
      min-height: 20px;
      height: 20px;
      font-size: 0.8rem;
    }

    .base.ellipsis {
      display: block;
      width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .base.round {
      min-height: 42px;
    }

    .base:not(:disabled) {
      cursor: pointer;
    }

    .base:hover {
      box-shadow: 0px 0px var(--hover-fuzzy) var(--hover-size) var(--regular-button-color, #b0bec5);
    }
    .base:active {
      box-shadow: 0px 0px var(--active-fuzzy) var(--active-size)
        var(--regular-button-color, #b0bec5);
    }

    /* Style for ROUND button */
    .base.round {
      border-radius: 50%;
      width: 3.2rem;
      height: 3.2rem;
    }

    /* STYLE for the TOGGLE button */
    :host([toggle]) .base {
      background-color: var(--toggle-button-color, lightgray);
      color: var(--on-toggle-button-color, black);
    }

    :host([toggle]) .base:hover {
      box-shadow: 0px 0px 0px 2px var(--toggle-button-color, lightgray);
    }
    :host([toggle]) .base:active {
      box-shadow: 0px 0px 0px 4px var(--toggle-button-color, lightgray);
    }

    :host([active]) .base {
      background-color: var(--toggle-button-active-color, #431c5d);
      color: var(--on-toggle-button-active-color, white);
    }

    :host([active]) .base:hover {
      box-shadow: 0px 0px 0px 2px var(--toggle-button-active-color, #431c5d);
    }

    :host([active]) .base:active {
      box-shadow: 0px 0px 0px 4px var(--toggle-button-active-color, #431c5d);
    }

    /* Style for IMPORTANT button */
    .base.important {
      background: var(--important-button, #dd2c00);
      color: var(--on-important-button, #fff);
    }

    .base.important:hover {
      box-shadow: 0px 0px 0px 2px var(--important-button, #dd2c00);
    }
    .base.important:active {
      box-shadow: 0px 0px 0px 4px var(--important-button, #dd2c00);
    }

    /* STYLE for the SPECIAL button */
    .base.special:hover {
      box-shadow: 0px 0px 0px 2px var(--important-button, #dd2c00);
    }
    .base.special:active {
      z-index: 1;
      box-shadow: 0px 0px 0px 4px var(--important-button, #dd2c00);
    }

    /* Confirming state */
    .base.confirming {
      background-color: var(--important-button, #dd2c00);
      color: var(--on-important-button, #fff);
    }

    .confirm-text {
      white-space: nowrap;
    }
  `;

  @property({ type: Boolean }) round = false;
  @property({ type: Boolean }) slim = false;
  @property({ type: Boolean }) ellipsis = false;
  @property({ type: Boolean }) important = false;
  @property({ type: Boolean }) special = false;
  @property({ type: Boolean }) toggle = false;
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: String, reflect: true }) key = '';
  @property({ type: Boolean, reflect: true }) alt = false;
  @property({ type: Boolean, reflect: true }) shift = false;
  @property({ type: Boolean }) confirm = false;
  @property({ type: String }) confirmText = 'Are you sure?';
  @property({ type: String }) href = '';
  @property({ type: String }) target = '';

  @state() private _confirming = false;
  private _confirmTimerId?: number;

  private _boundKeyDownHandler?: (event: KeyboardEvent) => void;

  connectedCallback() {
    super.connectedCallback();
    this._boundKeyDownHandler = (event: KeyboardEvent) => this._handleKeyDown(event);
    document.addEventListener('keydown', this._boundKeyDownHandler);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._boundKeyDownHandler) {
      document.removeEventListener('keydown', this._boundKeyDownHandler);
      this._boundKeyDownHandler = undefined;
    }
    this._cancelConfirmTimer();
  }

  private _handleKeyDown(event: KeyboardEvent) {
    if (this._isEditableKeyEvent(event)) return;

    if (this._confirming && event.key === 'Escape') {
      event.preventDefault();
      this._cancelConfirm();
      return;
    }

    if (
      event.key.toLowerCase() === this.key.toLowerCase() &&
      event.altKey === this.alt &&
      event.shiftKey === this.shift
    ) {
      event.preventDefault();
      (this.shadowRoot?.querySelector('.base') as HTMLElement)?.click();
    }
  }

  private _isEditableKeyEvent(event: KeyboardEvent): boolean {
    const path = event.composedPath();
    for (const target of path) {
      if (!(target instanceof HTMLElement)) continue;

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return true;
      }

      if (target.isContentEditable) {
        return true;
      }

      // Check if this node's shadow root has a focused editable element.
      // This catches forwarded events from custom elements like <t-input> or
      // <t-textarea> whose composedPath starts at the host, not the native
      // <input>/<textarea> inside their shadow DOM.
      if (target.shadowRoot) {
        const shadowActive = target.shadowRoot.activeElement;
        if (
          shadowActive instanceof HTMLInputElement ||
          shadowActive instanceof HTMLTextAreaElement ||
          (shadowActive instanceof HTMLElement && shadowActive.isContentEditable)
        ) {
          return true;
        }
      }
    }

    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      return true;
    }
    if (active instanceof HTMLElement && active.isContentEditable) {
      return true;
    }

    if (active instanceof HTMLElement) {
      const shadowActive = active.shadowRoot?.activeElement;
      if (shadowActive instanceof HTMLInputElement || shadowActive instanceof HTMLTextAreaElement) {
        return true;
      }
      if (shadowActive instanceof HTMLElement && shadowActive.isContentEditable) {
        return true;
      }
    }

    return false;
  }

  private _handleClick(event: Event) {
    if (!this.confirm) return;

    if (this._confirming) {
      // Second click — confirmed, let event bubble / navigation proceed
      this._cancelConfirmTimer();
      this._confirming = false;
      return;
    }

    // First click with confirm enabled — enter confirming state
    event.preventDefault();
    event.stopPropagation();
    this._confirming = true;
    this._startConfirmTimer();
  }

  private _startConfirmTimer() {
    this._confirmTimerId = window.setTimeout(() => {
      this._cancelConfirm();
    }, 3000);
  }

  private _cancelConfirmTimer() {
    if (this._confirmTimerId !== undefined) {
      clearTimeout(this._confirmTimerId);
      this._confirmTimerId = undefined;
    }
  }

  private _cancelConfirm() {
    this._confirming = false;
    this._cancelConfirmTimer();
  }

  private _getClasses() {
    const classes = ['base'];
    if (this.toggle) {
      classes.push('toggle');
    }
    if (this.round) {
      classes.push('round');
    }
    if (this.ellipsis) {
      classes.push('ellipsis');
    }
    if (this.important) {
      classes.push('important');
    }
    if (this.special) {
      classes.push('special');
    }
    if (this.slim) {
      classes.push('slim');
    }
    if (this._confirming) {
      classes.push('confirming');
    }
    return classes.join(' ');
  }

  render() {
    if (this.href) {
      return html`<a class="${this._getClasses()}" href=${this.href} target=${this.target || undefined} @click=${this._handleClick}>
        ${this._confirming ? html`<span class="confirm-text">${this.confirmText}</span>` : html`<slot></slot>`}
      </a>`;
    }
    return html`<button class="${this._getClasses()}" @click=${this._handleClick}>
      ${this._confirming ? html`<span class="confirm-text">${this.confirmText}</span>` : html`<slot></slot>`}
    </button>`;
  }
}
