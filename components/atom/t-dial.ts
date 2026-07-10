import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';
import './t-icon.js';
import './t-dropdown-button.js';

@customElement('t-dial')
export class Dial extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      user-select: none;
      position: relative;
    }

    .dial-container {
      position: relative;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dial-knob {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: var(--theme-color);
      cursor: grab;
      position: relative;
      transition: box-shadow 0.2s ease;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--on-theme-color);
      font-weight: bold;
      font-size: 0.8rem;
    }

    .dial-knob.disabled {
      background-color: var(--on-gray-out);
    }

    .dial-knob:hover {
      box-shadow: 0 0 var(--hover-fuzzy) var(--hover-size) var(--theme-color);
    }

    .dial-knob:active {
      cursor: grabbing;
      box-shadow: 0 0 var(--active-fuzzy) var(--active-size) var(--theme-color);
    }

    .label {
      margin-bottom: 4px;
      margin-top: 0;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 0.7em;
      line-height: 1;
      padding-bottom: 10px;
      padding-top: 10px;
    }

    .value-display {
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
      margin-bottom: 0;
      cursor: grab;
      touch-action: none;
    }

    .value-display.disabled {
      color: var(--on-gray-out);
      position: relative;
    }

    .value-display.disabled::after {
      content: '';
      position: absolute;
      top: 42%;
      left: 0;
      right: 0;
      height: 2px;
      background-color: var(--on-gray-out);
      transform: rotate(-15deg);
      transform-origin: center;
    }

    .value-controls {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: 8px;
    }

    .dial-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      flex-direction: column;
      align-items: flex-start;
    }

    .value-controls t-butt {
      margin: -2px;
    }

    .reset-content {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.4em;
      min-height: 1.6em;
    }

    .reset-icon {
      position: absolute;
      inset: 0;
      margin: auto;
      transform: scale(2);
      transform-origin: center;
    }

    .reset-text {
      position: relative;
      z-index: 1;
      margin-top: 1em;
      font-size: 0.69em;
      line-height: 1;
    }

    .floating-dial {
      position: absolute;
      left: var(--dial-x, 0px);
      top: var(--dial-y, 0px);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1000;
    }

    .floating-dial-icon {
      position: absolute;
      left: 50%;
      bottom: calc(100% - 6px);
      transform: translateX(-50%);
    }

    .floating-dial-value {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 10px);
      transform: translateX(-50%);
      font-size: 0.9rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .floating-dial-value.disabled {
      color: var(--on-gray-out);
    }

    .disabled {
      --regular-button-color: var(--gray-out, lightgray);
      --on-regular-buton-color: var(--on-gray-out, #595959);
    }

    .dropdown-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
    }

    .side-button {
      min-width: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .name-button {
      font-size: 0.6em;
    }

    .name-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-width: 50px;
    }

    .value-content {
      display: inline-block;
      min-width: 37px;
      text-align: center;
    }

    .non-interactive {
      pointer-events: none;
      cursor: default;
    }
  `;

  @property({ type: Number }) _value = 1;

  set value(newValue: number) {
    this._value = this._clamp(newValue);
    this.requestUpdate();
  }

  private _clamp(value: number) {
    if (this.min !== undefined && this.min !== null && !Number.isNaN(this.min))
      value = Math.max(this.min, value);
    if (this.max !== undefined && this.max !== null && !Number.isNaN(this.max))
      value = Math.min(this.max, value);
    return value;
  }

  get value(): number {
    return this.disabled ? 0 : this._value;
  }

  @property({ type: String }) unit = '';
  @property({ type: Number }) defaultValue: number | undefined;
  @property({ type: String }) label = '';
  @property({ type: String }) key = '';
  @property({ type: String }) iconName = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) step = 1;
  @property({ type: Number }) min: number | undefined;
  @property({ type: Number }) max: number | undefined;
  @property({ type: Boolean, attribute: 'show-disable-button' }) showDisableButton = false;

  private isDragging = false;
  private initialValue = 1;
  private justDragged = false;
  private startAngle = 0;
  private currentRotation = 0;
  private accumulatedAngle = 0;
  private dialVisible = false;
  private dialPositionX = 0;
  private dialPositionY = 0;

  private readonly _boundMouseMove = (event: MouseEvent) => this._handleMouseMove(event);
  private readonly _boundMouseUp = (event: MouseEvent) => this._handleMouseUp(event);
  private readonly _boundTouchMove = (event: TouchEvent) => this._handleTouchMove(event);
  private readonly _boundTouchEnd = (event: TouchEvent) => this._handleTouchEnd(event);
  private readonly _boundTouchCancel = (event: TouchEvent) => this._handleTouchEnd(event);
  private readonly _boundDocumentClick = (event: MouseEvent) => this._handleDocumentClick(event);

  private _getKnobElement(): HTMLElement | null {
    return this.shadowRoot?.querySelector('.dial-knob') ?? null;
  }

  private _getFixedDialPosition(): { x: number; y: number } | null {
    const valueDisplay = this.shadowRoot?.querySelector('.value-display');

    if (!(valueDisplay instanceof HTMLElement)) {
      return null;
    }

    const hostRect = this.getBoundingClientRect();
    const valueRect = valueDisplay.getBoundingClientRect();

    return {
      x: valueRect.left - hostRect.left + valueRect.width / 2,
      y: valueRect.bottom - hostRect.top,
    };
  }

  private _getAngleFromEvent(event: MouseEvent | Touch): number {
    let centerX = this.dialPositionX;
    let centerY = this.dialPositionY;

    if (this.dialVisible) {
      const hostRect = this.getBoundingClientRect();
      centerX = hostRect.left + this.dialPositionX;
      centerY = hostRect.top + this.dialPositionY;
    } else {
      const knob = this._getKnobElement();
      if (!knob) return 0;
      const rect = knob.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    }

    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  }

  private _showDial() {
    const position = this._getFixedDialPosition();
    if (!position) {
      return;
    }

    this.dialPositionX = position.x;
    this.dialPositionY = position.y;
    this.dialVisible = true;
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
    document.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    document.addEventListener('touchend', this._boundTouchEnd);
    document.addEventListener('touchcancel', this._boundTouchCancel);
    document.addEventListener('click', this._boundDocumentClick, true); // capture
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);
    document.removeEventListener('touchmove', this._boundTouchMove);
    document.removeEventListener('touchend', this._boundTouchEnd);
    document.removeEventListener('touchcancel', this._boundTouchCancel);
    document.removeEventListener('click', this._boundDocumentClick, true);
  }

  private _handleStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.isDragging = true;
    const touch = (event as TouchEvent).touches?.[0] || (event as MouseEvent);
    this.startAngle = this._getAngleFromEvent(touch);
    this.initialValue = this._value;
    this.justDragged = false;
    this.accumulatedAngle = 0; // Reset accumulation for each drag
  }

  private _handleMove(event: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    event.preventDefault();
    const touch = (event as TouchEvent).touches?.[0] || (event as MouseEvent);
    const currentAngle = this._getAngleFromEvent(touch);
    let deltaAngle = currentAngle - this.startAngle;

    // Normalize delta to handle crossing 180/-180
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    this.accumulatedAngle += deltaAngle;
    this.currentRotation += deltaAngle;

    const absAngle = Math.abs(this.accumulatedAngle);
    const fullLaps = Math.floor(absAngle / 360);
    const fractionalLap = (absAngle % 360) / 360;
    const direction = this.accumulatedAngle >= 0 ? 1 : -1;

    const fullValueChange = ((fullLaps * (fullLaps + 1)) / 2) * 10; // Sum k=1 to fullLaps of k*10
    const partialValueChange = fractionalLap * (fullLaps + 1) * 10;
    const totalValueChange = fullValueChange + partialValueChange;

    const effectiveMin = this.min ?? 0;
    const effectiveMax = this.max ?? Infinity;
    let newValue = this.initialValue + direction * Math.round(totalValueChange);

    // Clamp during drag calculation (like t-time-input does for min)
    newValue = Math.max(effectiveMin, Math.min(effectiveMax, newValue));
    this._value = newValue;

    // Update initialValue when hitting min
    if (this._value === effectiveMin) {
      this.initialValue = effectiveMin;
    }

    // Update initialValue when hitting max
    if (this._value === effectiveMax) {
      this.initialValue = effectiveMax;
    }

    // Reset accumulation if at min with negative direction
    if (this._value === effectiveMin && this.accumulatedAngle < 0) {
      this.accumulatedAngle = 0;
    }

    // Reset accumulation if at max with positive direction
    if (this._value === effectiveMax && this.accumulatedAngle > 0) {
      this.accumulatedAngle = 0;
    }

    this.startAngle = currentAngle;
    this.requestUpdate();
    this._dispatchValueChanged();
  }

  private _handleEnd() {
    this.isDragging = false;
    this.dialVisible = false;
    this.requestUpdate();
  }

  private _handleMouseDown(event: MouseEvent) {
    this._handleStart(event);
  }

  private _handleMouseMove(event: MouseEvent) {
    this._handleMove(event);
  }

  private _handleMouseUp(event: MouseEvent) {
    if (this.isDragging) {
      event.stopPropagation();
      event.preventDefault();
      this.justDragged = true;
    }
    this._handleEnd();
  }

  private _handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      this._handleStart(event);
    }
  }

  private _handleValueMouseDown(event: MouseEvent) {
    if (event.button !== 0) {
      return;
    }

    this._showDial();
    this._handleStart(event);
  }

  private _handleValueTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) {
      return;
    }

    this._showDial();
    this._handleStart(event);
  }

  private _handleTouchMove(event: TouchEvent) {
    if (event.touches.length === 1) {
      this._handleMove(event);
    }
  }

  private _handleTouchEnd(event: TouchEvent) {
    if (this.isDragging) {
      event.stopPropagation();
      event.preventDefault();
    }
    this._handleEnd();
  }

  private _handleDocumentClick(event: MouseEvent) {
    if (this.justDragged) {
      event.stopPropagation();
      event.preventDefault();
      this.justDragged = false;
    }
  }

  private _handleDefaultClick(event: MouseEvent) {
    event.stopPropagation();
    if (!this._hasDefaultValue()) return;
    this._value = this.defaultValue as number;
    this.currentRotation = 0;
    this.accumulatedAngle = 0;
    this._dispatchValueChanged();
  }

  private _handleIncrement() {
    const effectiveMax = this.max ?? Infinity;
    this._value = Math.min(effectiveMax, this._value + this.step);
    this._dispatchValueChanged();
  }

  private _handleDecrement() {
    const effectiveMin = this.min ?? 0;
    this._value = Math.max(effectiveMin, this._value - this.step);
    this._dispatchValueChanged();
  }

  private _handleDisabledToggle() {
    this.disabled = !this.disabled;
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: this._value, disabled: this.disabled },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _dispatchValueChanged() {
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: this._value, disabled: this.disabled },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _hasDefaultValue() {
    return this.defaultValue !== undefined && !Number.isNaN(this.defaultValue);
  }

  render() {
    return html`
      <div class="dial-row">
        <div class="value-controls ${this.disabled ? 'disabled' : ''}">
          ${this.showDisableButton
            ? html`
                <t-butt
                  class="side-button name-button"
                  .active=${!this.disabled}
                  .key=${this.key}
                  @click=${this._handleDisabledToggle}
                  title="${this.label}"
                >
                  <span class="name-content">
                    ${this.iconName ? html`<t-icon name="${this.iconName}"></t-icon>` : ''}
                    ${this.label ? html`<span>${this.label}</span>` : ''}
                  </span>
                </t-butt>
              `
            : this.iconName || this.label
              ? html`
                  <t-butt class="name-button non-interactive">
                    <span class="name-content">
                      ${this.iconName ? html`<t-icon name="${this.iconName}"></t-icon>` : ''}
                      ${this.label ? html`<span>${this.label}</span>` : ''}
                    </span>
                  </t-butt>
                `
              : ''}
          ${this._hasDefaultValue()
            ? html`
                <t-butt
                  @click=${(e: MouseEvent) => this._handleDefaultClick(e)}
                  title="${this.defaultValue}"
                >
                  <span class="reset-content">
                    <t-icon class="reset-icon" name="reset"></t-icon>
                    <span class="reset-text">${this.defaultValue}${this.unit}</span>
                  </span>
                </t-butt>
              `
            : ''}
          <t-butt
            class="icon"
            .key=${this.key}
            alt
            @click=${this._handleDecrement}
            title="Decrease by 1"
          >
            −
          </t-butt>
          <t-butt
            class="value-display ${this.disabled ? 'disabled' : ''}"
            @mousedown=${this._handleValueMouseDown}
            @touchstart=${this._handleValueTouchStart}
            title="Press and hold to use dial"
          >
            <span class="value-content">${this._value}${this.unit}</span>
          </t-butt>
          <t-butt
            class="icon"
            .key=${this.key}
            shift
            @click=${this._handleIncrement}
            title="Increase by 1"
          >
            +
          </t-butt>
        </div>
      </div>
      ${this.dialVisible
        ? html`<div
            class="floating-dial"
            style="--dial-x: ${this.dialPositionX}px; --dial-y: ${this.dialPositionY}px;"
          >
            <div class="floating-dial-value ${this.disabled ? 'disabled' : ''}">
              ${this._value}${this.unit}
            </div>
            <t-icon class="floating-dial-icon" name="rotate-flat" large></t-icon>
            <div class="dial-container">
              <div
                class="dial-knob ${this.disabled ? 'disabled' : ''}"
                style="transform: rotate(${this.currentRotation}deg);"
                @mousedown=${this._handleMouseDown}
                @touchstart=${this._handleTouchStart}
              >
                <t-icon class="dial-icon" name="rotate" large></t-icon>
              </div>
            </div>
          </div>`
        : ''}
    `;
  }
}
