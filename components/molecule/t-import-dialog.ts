/**
 * Import dialog (V2).
 *
 * A modal overlay for choosing how to handle a song that already exists locally
 * when downloading from a shared link. Offers three choices:
 *   - Import new markers (replace existing)
 *   - Merge with existing markers
 *   - Keep existing markers (abort)
 *
 * Does NOT import nDB or Firebase — all persistence is handled by the parent via events.
 *
 * Events (bubbles, composed):
 *   - `import-action-selected`: detail = { action: 'import' | 'merge' | 'keep' }
 *   - `dialog-cancelled`: no detail
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';

@customElement('t-import-dialog')
export class ImportDialog extends LitElement {
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
      max-width: 530px;
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
      line-height: 1.5;
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

  @property({ type: String }) fileName = '';

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this._cancel();
    }
  }

  private _handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
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

  private _selectAction(action: 'import' | 'merge' | 'keep') {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('import-action-selected', {
        detail: { action },
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
            <h2 class="dialog-title">Update markers?</h2>
          </div>

          <div class="dialog-body">
            <p>
              You seem to already have the song "${this.fileName}". Do you want to update that song
              with the new markers or merge them or abort?
            </p>
          </div>

          <div class="dialog-footer">
            <t-butt @click=${() => this._selectAction('import')}> Import new markers </t-butt>
            <t-butt @click=${() => this._selectAction('merge')}>
              Merge with existing markers
            </t-butt>
            <t-butt @click=${() => this._selectAction('keep')}> Keep existing markers </t-butt>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-import-dialog': ImportDialog;
  }
}
