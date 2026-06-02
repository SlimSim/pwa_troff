import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import '../atom/t-input.js';
import '../atom/t-textarea.js';
import '../atom/t-dial.js';
import '../atom/t-color-picker.js';
import '../atom/t-butt.js';
import type { TInput } from '../atom/t-input.js';
import type { TTextarea } from '../atom/t-textarea.js';
import type { TroffMarker } from '../../types/troff.d.js';

export type MarkerDialogMode = 'create' | 'edit';

@customElement('t-marker-dialog')
export class MarkerDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .marker-dropdown-content {
      padding: 16px 8px;
      border: 1px solid var(--on-theme-color, #ffffff);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 200px;
    }

    .marker-dropdown-content .marker-text {
      text-align: center;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .marker-dropdown-content t-dial .button-row {
      display: none;
    }

    .marker-dropdown-content .button-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
  `;

  @property({ type: String }) mode: MarkerDialogMode = 'create';
  @property({ type: Object }) markerData?: Partial<TroffMarker>;
  @property({ type: Number }) maxTime = 0;
  @property({ type: Boolean }) open = false;
  @property({ type: Number }) initialTime = 0;
  @property({ type: String }) suggestedName = '';

  @property({ type: Number }) markerTime = 0;
  @property({ type: String }) markerName = '';
  @property({ type: String }) markerInfo = '';
  @property({ type: String }) markerColor = '';

  @query('t-input')
  private _markerNameInput?: TInput;
  @query('t-textarea')
  private _markerInfoInput?: TTextarea;

  private _boundKeyHandler?: (event: KeyboardEvent) => void;
  private _focusRafId?: number;
  private _focusTimeoutIds: number[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._boundKeyHandler = (event: KeyboardEvent) => this._handleKeyboardShortcut(event);
    document.addEventListener('keydown', this._boundKeyHandler, { capture: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler, { capture: true });
      this._boundKeyHandler = undefined;
    }

    if (this._focusRafId !== undefined) {
      cancelAnimationFrame(this._focusRafId);
      this._focusRafId = undefined;
    }

    for (const timeoutId of this._focusTimeoutIds) {
      clearTimeout(timeoutId);
    }
    this._focusTimeoutIds = [];
  }

  protected override willUpdate(changedProperties: Map<string, unknown>) {
    super.willUpdate(changedProperties);

    const modeChanged = changedProperties.has('mode');
    const markerDataChanged = changedProperties.has('markerData');
    const openChangedToTrue = changedProperties.has('open') && this.open;
    const createDefaultsChanged =
      changedProperties.has('initialTime') || changedProperties.has('suggestedName');

    if (
      this.mode === 'edit' &&
      this.markerData &&
      (modeChanged || markerDataChanged || openChangedToTrue)
    ) {
      this._prefillFromMarkerData();
    }

    if (
      this.mode === 'create' &&
      this.open &&
      (modeChanged || openChangedToTrue || createDefaultsChanged)
    ) {
      this._resetForCreate();
    }
  }

  protected override updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has('open') && this.open && this.mode === 'create') {
      void this._focusAndSelectMarkerNameInput();
    }
  }

  private _resetForCreate() {
    this.markerName = this.suggestedName || '';
    this.markerInfo = '';
    this.markerColor = '';
    this.markerTime = this.initialTime;
  }

  private _prefillFromMarkerData() {
    if (!this.markerData) return;

    this.markerName = this.markerData.name || '';
    this.markerInfo = this.markerData.info || '';
    this.markerColor = this.markerData.color || '';
    this.markerTime =
      typeof this.markerData.time === 'number'
        ? this.markerData.time
        : Number(this.markerData.time) || 0;
  }

  private _getMarkerNativeInput() {
    const input = this._markerNameInput;
    if (!input) return undefined;
    const nativeInput = input.shadowRoot?.querySelector('input');
    if (!nativeInput || nativeInput.tagName !== 'INPUT') {
      return undefined;
    }

    return nativeInput as HTMLInputElement;
  }

  private _focusAndSelectMarkerNameInputAttempt(_source: string, _attempt: number) {
    const input = this._markerNameInput;
    const nativeInput = this._getMarkerNativeInput();

    if (!input || !nativeInput) return;

    input.focus();
    input.select();

    nativeInput.focus();
    nativeInput.select();
  }

  private async _focusAndSelectMarkerNameInput() {
    await this.updateComplete;

    const input = this._markerNameInput;
    if (!input) return;

    await input.updateComplete;

    if (this._focusRafId !== undefined) {
      cancelAnimationFrame(this._focusRafId);
      this._focusRafId = undefined;
    }

    for (const timeoutId of this._focusTimeoutIds) {
      clearTimeout(timeoutId);
    }
    this._focusTimeoutIds = [];

    this._focusRafId = requestAnimationFrame(() => {
      this._focusAndSelectMarkerNameInputAttempt('raf', 1);
      this._focusRafId = undefined;
    });

    this._focusTimeoutIds.push(
      window.setTimeout(() => this._focusAndSelectMarkerNameInputAttempt('timeout', 2), 0)
    );
    this._focusTimeoutIds.push(
      window.setTimeout(() => this._focusAndSelectMarkerNameInputAttempt('timeout', 3), 50)
    );
    this._focusTimeoutIds.push(
      window.setTimeout(() => this._focusAndSelectMarkerNameInputAttempt('timeout', 4), 150)
    );
  }

  private _handleKeyboardShortcut(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent('dialog-cancelled', {
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.handleOkClick();
    }
  }

  private _handleNameChange(event: CustomEvent) {
    if (typeof event.detail?.value === 'string') {
      this.markerName = event.detail.value;
    }
  }

  private _handleInfoChange(event: CustomEvent) {
    if (typeof event.detail?.value === 'string') {
      this.markerInfo = event.detail.value;
    }
  }

  private _handleTimeChange(event: CustomEvent) {
    this.markerTime = event.detail.value || 0;
  }

  private _handleColorChange(event: CustomEvent) {
    this.markerColor = event.detail.value || '';
  }

  private _handleDeleteClick() {
    if (this.mode === 'edit') {
      this.dispatchEvent(
        new CustomEvent('marker-deleted', {
          detail: { markerId: this.markerData?.id },
          bubbles: true,
          composed: true,
        })
      );
      this.dispatchEvent(
        new CustomEvent('dialog-completed', {
          bubbles: true,
          composed: true,
        })
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('dialog-cancelled', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  public handleOkClick() {
    const currentName = this._markerNameInput?.value ?? this.markerName;
    const currentInfo = this._markerInfoInput?.value ?? this.markerInfo;

    if (!currentName || !currentName.trim()) {
      console.warn('Marker name is required');
      return;
    }

    const marker: TroffMarker = {
      id: this.markerData?.id || Date.now().toString(),
      name: currentName.trim(),
      info: currentInfo,
      time: this.markerTime,
      color: this.markerColor || '',
    };

    if (this.mode === 'edit') {
      this.dispatchEvent(
        new CustomEvent('marker-updated', {
          detail: { marker },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('marker-created', {
          detail: { marker },
          bubbles: true,
          composed: true,
        })
      );
    }

    this.dispatchEvent(
      new CustomEvent('dialog-completed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const dialogTitle = this.mode === 'edit' ? 'Edit marker' : 'Add a marker';

    return html`
      <div class="marker-dropdown-content">
        <div class="marker-text">${dialogTitle}</div>
        <t-input
          label="Name"
          placeholder="Enter Name of marker"
          helper-text="Enter a name for the marker"
          .value=${this.markerName}
          clearable
          @input=${this._handleNameChange}
        ></t-input>
        <t-textarea
          label="Info"
          placeholder="Put extra marker info here"
          helper-text="You can add multiple lines"
          .value=${this.markerInfo}
          rows="4"
          @input=${this._handleInfoChange}
        ></t-textarea>
        <t-dial
          iconName="time"
          key="m"
          label="Time"
          unit="s"
          min="0"
          .max=${this.maxTime}
          .value=${this.markerTime}
          @value-changed=${this._handleTimeChange}
        ></t-dial>
        <t-color-picker
          label="Marker Color"
          .value=${this.markerColor}
          @change=${this._handleColorChange}
        ></t-color-picker>
        <div class="button-row">
          <t-butt confirm confirmText="Delete marker?" @click=${this._handleDeleteClick}
            ><t-icon name="delete"></t-icon
          ></t-butt>
          <t-butt important @click=${this.handleOkClick}>OK</t-butt>
        </div>
      </div>
    `;
  }
}
