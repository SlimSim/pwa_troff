/**
 * Zoom info dialog (V2 port of the v1 #zoomInstructionDialog).
 *
 * Explains how zoom works when zooming would change nothing (the timeline is
 * already zoomed to the active playing region).
 * Does NOT import nDB or Firebase — all persistence is handled by the parent via events.
 *
 * Events (bubbles, composed):
 *   - `zoom-info-closed`: detail = { dontShowAgain: boolean }
 *   - `dialog-cancelled`: no detail (fired alongside `zoom-info-closed` on plain dismiss,
 *     so parents listening for either event observe the dismissal)
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';

@customElement('t-zoom-info-dialog')
export class ZoomInfoDialog extends LitElement {
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

    .dialog-body p {
      margin: 0;
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

  private _dismiss(dontShowAgain: boolean) {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('zoom-info-closed', {
        detail: { dontShowAgain },
        bubbles: true,
        composed: true,
      })
    );
    if (!dontShowAgain) {
      this.dispatchEvent(
        new CustomEvent('dialog-cancelled', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleOk() {
    this._dismiss(false);
  }

  private _handleDontShowAgain() {
    this._dismiss(true);
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
            <h2 class="dialog-title">How zoom works</h2>
          </div>

          <div class="dialog-body">
            <p>
              When you press zoom, or 'Z', Troff will zoom to the active playing region, or the
              purple part of the timeline.
            </p>
            <p>
              If Troff is already zoomed to the active playing region, pressing 'Z' or the zoom
              button again changes nothing.
            </p>
            <p>
              You can also scroll to move the timeline up and down,<br />
              Ctrl+scroll (or Cmd+scroll) to zoom,<br />
              and pinch to zoom on touch screens.
            </p>
          </div>

          <div class="dialog-footer">
            <t-butt class="ok-btn" @click=${this._handleOk}>OK</t-butt>
            <t-butt class="dont-show-btn" @click=${this._handleDontShowAgain}
              >Don't show again</t-butt
            >
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-zoom-info-dialog': ZoomInfoDialog;
  }
}
