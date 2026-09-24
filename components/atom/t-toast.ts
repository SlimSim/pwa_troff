/**
 * Toast notification component (V2).
 *
 * A lightweight auto-dismissing notification that slides in from the right.
 * Used by `utils/notification.ts` as the rendering layer for `showToast()`.
 *
 * Properties:
 *   - `message`: text to display
 *   - `type`: 'success' | 'error' | 'info' (default 'info')
 *   - `duration`: ms before auto-dismiss (default 3000)
 *   - `actionLabel`: optional label for an action button
 *   - `loading`: when true, renders <t-loading> next to the message
 *
 * Events (bubbles, composed):
 *   - `toast-action-clicked`: fired when the action button is clicked
 *   - `toast-dismissed`: fired when the toast is removed (after animation)
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-loading.js';

@customElement('t-toast')
export class Toast extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .toast {
      padding: 12px 18px;
      border-radius: 6px;
      font-size: 0.95em;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
      color: #fff;
      line-height: 1.4;
      word-break: break-word;
      animation: toast-in 0.2s ease-out;
    }

    .toast.success {
      background: #2e7d32;
    }

    .toast.error {
      background: #c62828;
    }

    .toast.info {
      background: #1565c0;
    }

    .toast.has-action {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
    }

    .toast.dismissing {
      animation: toast-out 0.3s ease-out forwards;
    }

    .message {
      flex: 1;
    }

    t-loading {
      margin-right: 6px;
      vertical-align: middle;
    }

    t-butt {
      --butt-bg-color: rgba(255, 255, 255, 0.25);
      --butt-hover-bg-color: rgba(255, 255, 255, 0.35);
      --butt-active-bg-color: rgba(255, 255, 255, 0.45);
      --butt-border: 1px solid rgba(255, 255, 255, 0.6);
      --butt-color: #fff;
      font-size: 0.9em;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes toast-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
  `;

  @property({ type: String }) message = '';

  @property({ type: String }) type: 'success' | 'error' | 'info' = 'info';

  @property({ type: Number }) duration = 3000;

  @property({ type: String }) actionLabel = '';

  @property({ type: Boolean }) loading = false;

  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._startAutoDismiss();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearAutoDismiss();
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('duration') || changedProperties.has('message')) {
      this._restartAutoDismiss();
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _startAutoDismiss() {
    this._clearAutoDismiss();
    if (this.duration > 0) {
      this._dismissTimer = setTimeout(() => {
        this._dismiss();
      }, this.duration);
    }
  }

  private _restartAutoDismiss() {
    this._startAutoDismiss();
  }

  private _clearAutoDismiss() {
    if (this._dismissTimer !== null) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }

  private _dismiss() {
    const toastEl = this.shadowRoot?.querySelector('.toast');
    if (toastEl) {
      toastEl.classList.add('dismissing');
      setTimeout(() => {
        this.dispatchEvent(
          new CustomEvent('toast-dismissed', { bubbles: true, composed: true })
        );
      }, 300);
    } else {
      this.dispatchEvent(
        new CustomEvent('toast-dismissed', { bubbles: true, composed: true })
      );
    }
  }

  private _handleActionClick() {
    this._clearAutoDismiss();
    this.dispatchEvent(
      new CustomEvent('toast-action-clicked', { bubbles: true, composed: true })
    );
    this._dismiss();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const classes = ['toast', this.type];
    if (this.actionLabel) classes.push('has-action');

    return html`
      <div class=${classes.join(' ')}>
        ${this.loading ? html`<t-loading></t-loading>` : ''}
        <span class="message">${this.message}</span>
        ${this.actionLabel
          ? html`<t-butt ghost @click=${this._handleActionClick}
              >${this.actionLabel}</t-butt
            >`
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-toast': Toast;
  }
}
