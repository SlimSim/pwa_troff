import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';
import './t-icon.js';
import './t-dropdown-button.js';

@customElement('t-slide-stepper')
export class SlideStepper extends LitElement {
  static styles = css`
    :host {
      display: block;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    .wrapper {
      display: grid;
      gap: 6px;
    }

    .label {
      margin: 0;
      font-size: 0.78rem;
      opacity: 0.9;
    }

    .controls {
      display: flex;
      align-items: center;
    }

    .controls.disabled {
      --regular-button-color: var(--gray-out, lightgray);
      --on-regular-buton-color: var(--on-gray-out, #595959);
    }

    .controls > t-butt {
      margin: 0 -2px;
    }

    .side-button {
      min-width: 38px;
    }

    .value-button-wrap {
      position: relative;
      min-height: 39px;
      overflow: visible;
      margin: 0 -2px;
    }

    .value-button-wrap.disabled::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 7px;
      right: 7px;
      height: 2px;
      background-color: var(--on-gray-out, #595959);
      transform: rotate(-15deg);
      transform-origin: center;
      z-index: 4;
      pointer-events: none;
    }

    .slide-hint {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s ease-in-out;
      z-index: 3;
      color: var(--on-secondary-color, #000);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide-hint.up {
      top: -24px;
    }

    .slide-hint.down {
      bottom: -24px;
      transform: translateX(-50%) rotate(180deg);
    }

    .slide-hint.visible {
      opacity: 1;
    }

    .slide-hint t-icon {
      font-size: 1.25rem;
    }

    .dropdown-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
    }
  `;

  @property({ type: Number }) _value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 999;
  @property({ type: Number }) step = 1;
  @property({ type: Number, attribute: 'default' }) defaultValue: number | null = null;
  @property({ type: String }) label = '';
  @property({ type: String }) unit = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean, attribute: 'show-disable-button' }) showDisableButton = false;
  @property({ type: Boolean, attribute: 'show-plus-minus-buttons' }) showPlusMinusButtons = false;
  @property({ type: Boolean, attribute: 'put-buttons-in-dropdown' }) putButtonsInDropdown = false;

  set value(newValue: number) {
    if (this.disabled) {
      return;
    }

    this._value = this._clamp(newValue);
    this.requestUpdate();
  }

  get value(): number {
    return this.disabled ? 0 : this._value;
  }

  private _dragging = false;
  private _activePointerId: number | null = null;
  private _dragStartY = 0;
  private _dragStartValue = 0;
  private _valueButtonElement: HTMLElement | null = null;

  private _boundPointerMove = (event: PointerEvent) => this._onPointerMove(event);
  private _boundPointerUp = (event: PointerEvent) => this._onPointerUp(event);
  private _boundPointerCancel = (event: PointerEvent) => this._onPointerUp(event);

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointermove', this._boundPointerMove);
    document.addEventListener('pointerup', this._boundPointerUp);
    document.addEventListener('pointercancel', this._boundPointerCancel);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointermove', this._boundPointerMove);
    document.removeEventListener('pointerup', this._boundPointerUp);
    document.removeEventListener('pointercancel', this._boundPointerCancel);
  }

  private _clamp(value: number) {
    return Math.max(this.min, Math.min(this.max, value));
  }

  private _setValue(nextValue: number) {
    const normalized = this._clamp(nextValue);
    if (normalized === this._value) {
      return;
    }

    this._value = normalized;
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: this.value, disabled: this.disabled },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _increment() {
    this._setValue(this._value + this.step);
  }

  private _decrement() {
    this._setValue(this._value - this.step);
  }

  private _onCenterPointerDown(event: PointerEvent) {
    event.preventDefault();
    this._dragging = true;
    this._activePointerId = event.pointerId;
    this._dragStartY = event.clientY;
    this._dragStartValue = this._value;
    this._valueButtonElement = event.currentTarget as HTMLElement;
    this._valueButtonElement?.setPointerCapture(event.pointerId);
    this.requestUpdate();
  }

  private _onPointerMove(event: PointerEvent) {
    if (!this._dragging || this._activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const dragDistance = this._dragStartY - event.clientY;
    const pixelsPerStep = 16;
    const valueDelta = Math.round(dragDistance / pixelsPerStep) * this.step;
    this._setValue(this._dragStartValue + valueDelta);
  }

  private _onPointerUp(event: PointerEvent) {
    if (!this._dragging || this._activePointerId !== event.pointerId) {
      return;
    }

    this._dragging = false;
    this._activePointerId = null;
    this._valueButtonElement?.releasePointerCapture(event.pointerId);
    this._valueButtonElement = null;
    this.requestUpdate();
  }

  private _displayValue() {
    return `${this._value}${this.unit}`;
  }

  private _hasDefaultValue() {
    return this.defaultValue !== null && !Number.isNaN(this.defaultValue);
  }

  private _applyDefaultValue() {
    if (!this._hasDefaultValue()) {
      return;
    }

    this._value = this._clamp(this.defaultValue as number);
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: this.value, disabled: this.disabled },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggleDisabled() {
    this.disabled = !this.disabled;
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: this.value, disabled: this.disabled },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="wrapper">
        ${this.label ? html`<p class="label">${this.label}</p>` : ''}
        <div class="controls ${this.disabled ? 'disabled' : ''}">
          ${this.putButtonsInDropdown
            ? html`
                <t-dropdown-button position="up" align="left">
                  <t-butt class="side-button" slot="button" title="Options">
                    <t-icon name="chevron-up"></t-icon>
                  </t-butt>
                  <div class="dropdown-row" slot="dropdown">
                    ${this._hasDefaultValue()
                      ? html`
                          <t-butt
                            class="side-button"
                            @click=${this._applyDefaultValue}
                            title="${this.defaultValue}${this.unit}"
                          >
                            ${this.defaultValue}${this.unit}
                          </t-butt>
                        `
                      : ''}
                    ${this.showDisableButton
                      ? html`
                          <t-butt
                            class="side-button"
                            .active=${this.disabled}
                            @click=${this._toggleDisabled}
                            title="Disable ${this.label}"
                          >
                            <t-icon name="disable"></t-icon>
                          </t-butt>
                        `
                      : ''}
                  </div>
                </t-dropdown-button>
              `
            : this._hasDefaultValue()
              ? html`
                  <t-butt
                    class="side-button"
                    @click=${this._applyDefaultValue}
                    title="${this.defaultValue}${this.unit}"
                  >
                    ${this.defaultValue}${this.unit}
                  </t-butt>
                `
              : ''}
          ${this.showPlusMinusButtons
            ? html`<t-butt @click=${this._decrement} title="Decrease"> - </t-butt>`
            : ''}

          <div class="value-button-wrap ${this.disabled ? 'disabled' : ''}">
            <t-butt
              @pointerdown=${this._onCenterPointerDown}
              title="Press and hold, then slide up or down"
            >
              ${this._displayValue()}
            </t-butt>
            <div class="slide-hint up ${this._dragging ? 'visible' : ''}">
              <t-icon name="chevron-up"></t-icon>
            </div>
            <div class="slide-hint down ${this._dragging ? 'visible' : ''}">
              <t-icon name="chevron-up"></t-icon>
            </div>
          </div>

          ${this.showPlusMinusButtons
            ? html`<t-butt @click=${this._increment} title="Increase"> + </t-butt>`
            : ''}
          ${this.putButtonsInDropdown
            ? ''
            : this.showDisableButton
              ? html`
                  <t-butt
                    class="side-button"
                    .active=${this.disabled}
                    @click=${this._toggleDisabled}
                    title="Disable ${this.label}"
                  >
                    <t-icon name="disable"></t-icon>
                  </t-butt>
                `
              : ''}
        </div>
      </div>
    `;
  }
}
