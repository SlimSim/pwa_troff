/**
 * V2 welcome dialog shown to returning users (those with millisFirstTimeStartingApp)
 * when they have no preference set yet (making v2 the default rollout).
 *
 * No nDB inside — parent (v2Script) reacts to events to set TROFF_SETTING_PREFER_VERSION.
 *
 * Modeled precisely on t-zoom-info-dialog.ts (Lit, open @property, overlay/dialog CSS
 * using theme vars, <t-butt> only, overlay/keyboard dismiss, dispatches events).
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';

@customElement('t-v2-welcome-dialog')
export class V2WelcomeDialog extends LitElement {
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
      flex: 1;
      overflow-y: auto;
    }

    .dialog-body p {
      margin: 0;
    }

    .dialog-body ul {
      margin-top: 12px
    }

    .dialog-body ul li {
      padding-top: 4px;
    }

    .dialog-footer {
      display: flex;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .small {
      font-size: 0.75rem;
    }

    .only-wide {
      display: none;
    }

    @media (min-width: 768px) {
      .only-small {
        display: none;
      }

      .only-wide {
        display: inline;
      }

    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this._dismiss(false);
    }
  }

  private _handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this._dismiss(false);
    }
  }

  private _dismiss(isSwitchBack: boolean) {
    this.open = false;
    if (isSwitchBack) {
      this.dispatchEvent(
        new CustomEvent('v2-welcome-switch-back', {
          bubbles: true,
          composed: true,
        })
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('v2-welcome-continue', {
          bubbles: true,
          composed: true,
        })
      );
      this.dispatchEvent(
        new CustomEvent('dialog-cancelled', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleContinue() {
    this._dismiss(false);
  }

  private _handleSwitchBack() {
    this._dismiss(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    return html`
      <div
        class="overlay ${this.open ? 'open' : ''}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-welcome-title"
        @click=${this._handleOverlayClick}
        @keydown=${this._handleKeydown}
      >
        <div class="dialog">
          <div class="dialog-header">
            <h2 id="v2-welcome-title" class="dialog-title">Welcome to Troff 2.0!</h2>
          </div>

          <div class="dialog-body">
            <p>Troff has a new design with <strong>improved mobile support</strong>.</p>
            <ul>
              <li>Your songs are in the header.</li>
              <li>
                <span class="only-small">Settings are in the footer on mobile.</span>
                <span class="only-wide">Settings are to the left on desktop.</span>
              </li>
              <li>Pinch the timeline to zoom.</li>
              <li>Your songs and settings are kept when switching versions.</li>
            </ul>
            <p class="small">You can switch back to the old version at any time.</p>
          </div>

          <div class="dialog-footer">
            <t-butt style="flex: 1;" fullWidth important @click=${this._handleContinue}
              >Continue</t-butt
            >
            <t-butt ghost @click=${this._handleSwitchBack}
              >Use old<br />version</t-butt
            >
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-v2-welcome-dialog': V2WelcomeDialog;
  }
}
