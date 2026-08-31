/**
 * Import/Export dialog for markers, states, and song info.
 *
 * Events (bubbles, composed):
 *   - `import-requested`: detail = { data: TroffManualImportExport, mode: 'replace' | 'merge' } - fired when user confirms import
 *   - `dialog-cancelled`: no detail
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-butt.js';
import type { TroffManualImportExport } from '../../types/troff.d.js';

@customElement('t-import-export-dialog')
export class ImportExportDialog extends LitElement {
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
      border-radius: 8px;
      width: 100%;
      max-width: 520px;
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

    .dialog-footer {
      display: flex;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .section-label {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 6px;
      opacity: 0.8;
    }

    .info-text {
      font-size: 0.85rem;
      opacity: 0.8;
      line-height: 1.5;
    }

    .export-output {
      width: 100%;
      min-height: 120px;
      max-height: 300px;
      padding: 12px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.75rem;
      line-height: 1.4;
      box-sizing: border-box;
      background: var(--text-area, #f5f5f5);
      color: var(--on-text-area, #000);
      resize: vertical;
      overflow: auto;
    }

    .import-input {
      width: 100%;
      min-height: 120px;
      max-height: 300px;
      padding: 12px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.75rem;
      line-height: 1.4;
      box-sizing: border-box;
      background: var(--text-area, #f5f5f5);
      color: var(--on-text-area, #000);
      resize: vertical;
      overflow: auto;
    }

    .import-input:focus {
      outline: none;
      border-color: var(--theme-color, #003366);
    }

    .button-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-primary {
      --butt-bg-color: var(--theme-color, #003366);
    }

    .btn-danger {
      --butt-bg-color: var(--accent-color-2, #dd2c00);
    }

    .mode-toggle {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .mode-help {
      margin-top: 4px;
      font-size: 0.8rem;
    }

    .mode-option {
      flex: 1;
    }

    .mode-option t-butt {
      width: 100%;
    }

    .error-message {
      color: var(--accent-color-2, #dd2c00);
      font-size: 0.85rem;
      margin-top: 4px;
    }

    .stats-row {
      display: flex;
      gap: 16px;
      font-size: 0.85rem;
      opacity: 0.8;
      flex-wrap: wrap;
    }

    @media (min-width: 576px) {
      .dialog {
        max-width: 600px;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) exportData: TroffManualImportExport | null = null;

  @state() private _importText = '';
  @state() private _importMode: 'replace' | 'merge' = 'replace';
  @state() private _importError = '';
  @state() private _showImport = false;
  @state() private _exportText = '';

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      if (this.exportData) {
        this._exportText = JSON.stringify(this.exportData, null, 2);
      }
      this._importText = '';
      this._importError = '';
      this._showImport = false;
      this._importMode = 'replace';
    }
  }

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
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

  private _handleImportClick() {
    this._showImport = true;
    this._importError = '';
  }

  private _handleImportConfirm() {
    const text = this._importText.trim();
    if (!text) {
      this._importError = 'Please paste the JSON data to import.';
      return;
    }

    let data: TroffManualImportExport;
    try {
      data = JSON.parse(text);
    } catch {
      this._importError = 'Invalid JSON. Please check the format.';
      return;
    }

    // Validate required fields
    if (!data.aoMarkers || !Array.isArray(data.aoMarkers)) {
      this._importError = 'Invalid data: missing or invalid markers array.';
      return;
    }
    if (data.aoStates === undefined || !Array.isArray(data.aoStates)) {
      this._importError = 'Invalid data: missing or invalid states array.';
      return;
    }
    if (data.strSongInfo === undefined) {
      this._importError = 'Invalid data: missing song info.';
      return;
    }

    this.dispatchEvent(
      new CustomEvent('import-requested', {
        detail: { data, mode: this._importMode },
        bubbles: true,
        composed: true,
      })
    );
    this._cancel();
  }

  private _copyExportText() {
    void navigator.clipboard.writeText(this._exportText);
  }

  private _renderExportView() {
    const markerCount = this.exportData?.aoMarkers?.length ?? 0;
    const stateCount = this.exportData?.aoStates?.length ?? 0;
    const songInfoLength = this.exportData?.strSongInfo?.length ?? 0;

    return html`
      <div>
        <div class="section-label">Export Markers, States & Song Info</div>
        <p class="info-text">
          Copy the JSON below to save your markers, states, settings and song info. You can import
          this into another Troff instance with the same song.
        </p>
        <div class="stats-row">
          <span>${markerCount} marker${markerCount !== 1 ? 's' : ''}</span>
          <span>${stateCount} state${stateCount !== 1 ? 's' : ''}</span>
          <span>${songInfoLength} char${songInfoLength !== 1 ? 's' : ''} song info</span>
        </div>
        <textarea
          class="export-output"
          readonly
          .value=${this._exportText}
          aria-label="Exported JSON data"
        ></textarea>
        <div class="button-group">
          <t-butt class="btn-primary" @click=${this._copyExportText}> Copy to Clipboard </t-butt>
        </div>
      </div>
    `;
  }

  private _renderImportView() {
    return html`
      <div>
        <div class="section-label">Import Markers, States & Song Info</div>
        <p class="info-text">
          Paste the JSON data you previously exported. This will restore markers, states, and song
          info.
        </p>
        <div class="mode-toggle">
          <div class="mode-option">
            <t-butt
              toggle
              ellipsis
              .active=${this._importMode === 'replace'}
              @click=${() => {
                this._importMode = 'replace';
              }}
            >
              Replace existing
            </t-butt>
          </div>
          <div class="mode-option">
            <t-butt
              toggle
              ellipsis
              .active=${this._importMode === 'merge'}
              @click=${() => {
                this._importMode = 'merge';
              }}
            >
              Merge with existing
            </t-butt>
          </div>
        </div>
        <p class="info-text mode-help">
          ${this._importMode === 'replace'
            ? 'Deletes all current markers and states before importing.'
            : 'Keeps current markers and adds imported ones (may create duplicates).'}
        </p>
        <textarea
          class="import-input"
          .value=${this._importText}
          placeholder="Paste JSON here..."
          aria-label="Import JSON data"
          @input=${(e: Event) => {
            this._importText = (e.target as HTMLTextAreaElement).value;
            this._importError = '';
          }}
        ></textarea>
        ${this._importError ? html`<div class="error-message">${this._importError}</div>` : ''}
        <div class="button-group">
          <t-butt
            @click=${() => {
              this._showImport = false;
              this._importText = '';
              this._importError = '';
            }}
          >
            Back
          </t-butt>
          <t-butt class="btn-primary" @click=${this._handleImportConfirm}> Import </t-butt>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="overlay ${this.open ? 'open' : ''}" @click=${this._handleOverlayClick}>
        <div class="dialog">
          <div class="dialog-header">
            <h2 class="dialog-title">Import / Export</h2>
          </div>

          <div class="dialog-body">
            ${!this._showImport ? this._renderExportView() : this._renderImportView()}
          </div>

          <div class="dialog-footer">
            ${!this._showImport
              ? html`
                  <t-butt @click=${this._handleImportClick}>Import</t-butt>
                  <t-butt @click=${this._cancel}>Close</t-butt>
                `
              : html` <t-butt @click=${this._cancel}>Close</t-butt> `}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-import-export-dialog': ImportExportDialog;
  }
}
