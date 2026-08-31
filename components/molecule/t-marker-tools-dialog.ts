/**
 * Marker tools dialog (V2) — copy, move, delete, stretch markers.
 * Ported from the v1 dialogs (copyMarkersDialog, moveMarkersDialog,
 * deleteMarkersDialog, stretchMarkersDialog).
 *
 * Events (bubbles, composed):
 *   - `marker-tools-action`: detail = { action: string, value?: number } —
 *     fired when the user confirms an operation. The dialog closes itself
 *     unless validation shows an inline error instead.
 *   - `dialog-cancelled`: no detail
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-dial.js';

export type MarkerToolsMode = 'copy' | 'move' | 'delete' | 'stretch';

@customElement('t-marker-tools-dialog')
export class MarkerToolsDialog extends LitElement {
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

    .info-text {
      font-size: 0.85rem;
      opacity: 0.8;
      line-height: 1.5;
    }

    .button-group {
      display: flex;
      gap: 8px;
      padding-top: 8px;
      flex-wrap: wrap;
    }

    .move-markers-buttons {
      display: flex;
      gap: 8px;
      flex-direction: column;
      flex-wrap: wrap;
    }

    .btn-primary {
      --butt-bg-color: var(--theme-color, #003366);
    }

    .btn-danger {
      --butt-bg-color: var(--accent-color-2, #dd2c00);
    }

    .error-message {
      color: var(--accent-color-2, #dd2c00);
      font-size: 0.85rem;
    }

    @media (min-width: 576px) {
      .dialog {
        max-width: 600px;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) mode: MarkerToolsMode = 'copy';
  @property({ type: Number }) nrOfSelectedMarkers = 0;
  @property({ type: Number }) initialTime = 0;
  @property({ type: Number }) totalMarkers = 0;

  @state() private _value = 0;
  @state() private _error = '';

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      this._value = this.mode === 'copy' ? this.initialTime : this.mode === 'stretch' ? 100 : 0;
      this._error = '';
    }
  }

  private get _title(): string {
    switch (this.mode) {
      case 'copy':
        return 'Copy markers';
      case 'move':
        return 'Move markers';
      case 'delete':
        return 'Delete markers';
      case 'stretch':
        return 'Stretch markers';
      default:
        return '';
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

  private _dispatch(action: string, value?: number) {
    this.dispatchEvent(
      new CustomEvent('marker-tools-action', {
        detail: { action, value },
        bubbles: true,
        composed: true,
      })
    );
    this.open = false;
  }

  private _handleValueChanged(event: CustomEvent) {
    this._value = event.detail.value ?? 0;
    this._error = '';
  }

  private _handleCopy() {
    this._dispatch('copy', this._value);
  }

  private _handleMove(action: 'moveUp' | 'moveDown' | 'moveAllUp' | 'moveAllDown') {
    this._dispatch(action, this._value);
  }

  private _handleStretch(action: 'stretchSelected' | 'stretchAll') {
    const percent = this._value;
    if (percent === 100) {
      this._error = '100% will not change markers';
      return;
    }
    this._dispatch(action, percent);
  }

  private _handleDelete(action: 'deleteSelected' | 'deleteAll') {
    const tooFewMarkersLeft =
      action === 'deleteSelected'
        ? this.totalMarkers - this.nrOfSelectedMarkers < 2
        : this.totalMarkers < 2;
    if (tooFewMarkersLeft) {
      this._error = 'You must have at least 2 markers left';
      return;
    }
    this._dispatch(action);
  }

  private _renderCopyView() {
    return html`
      <div>
        <p class="info-text">Copy the ${this.nrOfSelectedMarkers} selected markers to:</p>
        <t-dial
          iconName="time"
          label="Time"
          unit="s"
          min="0"
          .value=${this._value}
          defaultValue=${this.initialTime}
          @value-changed=${this._handleValueChanged}
        ></t-dial>
        <div class="button-group">
          <t-butt class="btn-primary" @click=${this._handleCopy}>Copy markers</t-butt>
        </div>
      </div>
    `;
  }

  private _renderMoveView() {
    return html`
      <div>
        <p class="info-text">
          Move all the markers at the same time, or move only those markers between the selected
          markers (including the selected markers).
        </p>
        <t-dial
          iconName="time"
          label="Move by"
          unit="s"
          min="0"
          .value=${this._value}
          defaultValue="0"
          @value-changed=${this._handleValueChanged}
        ></t-dial>
        <div class="button-group">
          <div class="move-markers-buttons">
            <t-butt class="btn-primary" fullWidth @click=${() => this._handleMove('moveUp')}>
              move markers up
            </t-butt>
            <t-butt class="btn-primary" fullWidth @click=${() => this._handleMove('moveDown')}>
              move markers down
            </t-butt>
          </div>
          <div class="move-markers-buttons">
            <t-butt fullWidth @click=${() => this._handleMove('moveAllUp')}
              >move all markers up</t-butt
            >
            <t-butt fullWidth @click=${() => this._handleMove('moveAllDown')}
              >move all markers down</t-butt
            >
          </div>
        </div>
      </div>
    `;
  }

  private _renderDeleteView() {
    return html`
      <div>
        <p class="info-text">
          Delete all the markers at the same time, or delete only those markers between the selected
          markers (including the selected markers).
        </p>
        <div class="button-group">
          <t-butt class="btn-danger" @click=${() => this._handleDelete('deleteSelected')}>
            delete selected markers
          </t-butt>
          <t-butt class="btn-danger" @click=${() => this._handleDelete('deleteAll')}>
            delete all markers
          </t-butt>
        </div>
      </div>
    `;
  }

  private _renderStretchView() {
    return html`
      <div>
        <p class="info-text">
          Stretch all the markers so that the distance between them increases or decreases!
        </p>
        <t-dial
          iconName="speed"
          label="Stretch"
          unit="%"
          min="0"
          .value=${this._value}
          defaultValue="100"
          @value-changed=${this._handleValueChanged}
        ></t-dial>
        <div class="button-group">
          <t-butt class="btn-primary" @click=${() => this._handleStretch('stretchSelected')}>
            stretch selected markers
          </t-butt>
          <t-butt @click=${() => this._handleStretch('stretchAll')}>stretch all markers</t-butt>
        </div>
      </div>
    `;
  }

  private _renderBody() {
    switch (this.mode) {
      case 'copy':
        return this._renderCopyView();
      case 'move':
        return this._renderMoveView();
      case 'delete':
        return this._renderDeleteView();
      case 'stretch':
        return this._renderStretchView();
    }
  }

  render() {
    return html`
      <div class="overlay ${this.open ? 'open' : ''}" @click=${this._handleOverlayClick}>
        <div class="dialog">
          <div class="dialog-header">
            <h2 class="dialog-title">${this._title}</h2>
          </div>

          <div class="dialog-body">
            ${this._renderBody()}
            ${this._error ? html`<div class="error-message">${this._error}</div>` : ''}
          </div>

          <div class="dialog-footer">
            <t-butt @click=${this._cancel}>Close</t-butt>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-marker-tools-dialog': MarkerToolsDialog;
  }
}
