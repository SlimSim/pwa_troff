/**
 * Text input dialog (V2).
 *
 * A modal overlay for capturing a single line of text (e.g. a state name).
 * Used as an in-app replacement for `window.prompt`.
 * Does NOT import nDB or Firebase — all persistence is handled by the parent via events.
 *
 * Events (bubbles, composed):
 *   - `text-input-confirmed`: detail = { value: string }
 *   - `dialog-cancelled`: no detail
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-input.js';

@customElement('t-text-input-dialog')
export class TextInputDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* Overlay */
    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .overlay.open {
      display: flex;
    }

    /* Dialog box */
    .dialog {
      background: var(--on-theme-color, #fff);
      color: var(--theme-color, #000);
      border-radius: var(--button-border-radius, 8px);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .dialog-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .dialog-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      overflow-y: auto;
    }

    .error {
      font-size: 12px;
      color: var(--accent-color-2, #dd2c00);
      margin-top: 2px;
    }

    .dialog-footer {
      display: flex;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      justify-content: flex-end;
      flex-wrap: wrap;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @property({ type: String }) title = '';

  @property({ type: String }) label = '';

  @property({ type: String }) placeholder = '';

  @property({ type: String }) initialValue = '';

  @property({ type: Boolean }) required = false;

  @state() private _value = '';

  @state() private _error = '';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      this._value = this.initialValue;
      this._error = '';
    }
  }

  async updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      await this.updateComplete;
      const tInput = this.shadowRoot?.querySelector('t-input') as
        | (HTMLElement & { focus(): void; select(): void })
        | null;
      tInput?.focus();
      tInput?.select();
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this._cancel();
    }
  }

  private _handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this._confirm();
    } else if (event.key === 'Escape') {
      this._cancel();
    }
  }

  private _cancel() {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('dialog-cancelled', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _confirm() {
    const trimmed = this._value.trim();
    if (this.required && trimmed === '') {
      this._error = 'Please enter a value';
      return;
    }
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('text-input-confirmed', {
        detail: { value: trimmed },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    return html`
      <div
        class="overlay ${this.open ? 'open' : ''}"
        @click=${this._handleOverlayClick}
        @keydown=${this._handleKeydown}
      >
        <div class="dialog">
          <div class="dialog-header">
            <h2 class="dialog-title">${this.title}</h2>
          </div>

          <div class="dialog-body">
            <t-input
              id="text-input-field"
              .value=${this._value}
              label=${this.label}
              placeholder=${this.placeholder}
              ?required=${this.required}
              @input=${(e: CustomEvent) => {
                if (e.detail && typeof e.detail.value === 'string') {
                  this._value = e.detail.value;
                }
              }}
            ></t-input>

            ${this._error
              ? html`<div class="error" role="alert">${this._error}</div>`
              : ''}
          </div>

          <div class="dialog-footer">
            <t-butt class="cancel-btn" @click=${this._cancel}>Cancel</t-butt>
            <t-butt class="ok-btn" @click=${this._confirm}>OK</t-butt>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-text-input-dialog': TextInputDialog;
  }
}
