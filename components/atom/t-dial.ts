import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';

@customElement('t-dial')
export class Dial extends LitElement {
  private static readonly KNOB_SIZE = 80;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      user-select: none;
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

    .title-inline {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
    }

    .title-label {
      margin: 0;
      font-size: 0.7em;
      line-height: 1;
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
      position: fixed;
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
  `;

  @property({ type: Number }) _value = 1;

  set value(newValue: number) {
    if (this.disabled) {
      return;
    }

    this._value = newValue;
    this.requestUpdate();
  }

  get value(): number {
    return this.disabled ? 0 : this._value;
  }

  @property({ type: String }) unit = '';
  @property({ type: Number }) defaultValue = 1;
  @property({ type: String }) label = '';
  @property({ type: String }) key = '';
  @property({ type: String }) iconName = '';
  @property({ type: Boolean }) disabled = false;

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

  private _getValueControlsElement(): HTMLElement | null {
    return this.shadowRoot?.querySelector('.value-controls') ?? null;
  }

  private _getFixedDialPosition(): { x: number; y: number } | null {
    const valueControls = this._getValueControlsElement();
    const valueDisplay = this.shadowRoot?.querySelector('.value-display');

    if (!(valueControls instanceof HTMLElement) || !(valueDisplay instanceof HTMLElement)) {
      return null;
    }

    const controlsRect = valueControls.getBoundingClientRect();
    const valueRect = valueDisplay.getBoundingClientRect();

    return {
      x: valueRect.left + valueRect.width / 2,
      y: controlsRect.top + Dial.KNOB_SIZE / 2,
    };
  }

  private _getAngleFromEvent(event: MouseEvent | Touch): number {
    let centerX = this.dialPositionX;
    let centerY = this.dialPositionY;

    if (!this.dialVisible) {
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

    const newValue = Math.max(0, this.initialValue + direction * Math.round(totalValueChange));
    this._value = newValue;

    // Update initialValue when hitting min
    if (this._value === 0) {
      this.initialValue = 0;
    }

    // Reset accumulation if negative at min
    if (this._value === 0 && this.accumulatedAngle < 0) {
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
    this._value = this.defaultValue;
    this.currentRotation = 0;
    this.accumulatedAngle = 0;
    this._dispatchValueChanged();
  }

  private _handleIncrement() {
    this._value = Math.max(0, this._value + 1);
    this._dispatchValueChanged();
  }

  private _handleDecrement() {
    this._value = Math.max(0, this._value - 1);
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

  render() {
    return html`
      <div class="dial-row">
        ${this.iconName || this.label
          ? html`<div class="title-inline">
              ${this.iconName ? html`<t-icon name="${this.iconName}"></t-icon>` : ''}
              ${this.label ? html`<p class="title-label">${this.label}</p>` : ''}
            </div>`
          : ''}
        <div class="value-controls">
          <t-butt
            .key=${this.key}
            @click=${(e: MouseEvent) => this._handleDefaultClick(e)}
            title="${this.defaultValue}"
          >
            <span class="reset-content">
              <t-icon class="reset-icon" name="reset"></t-icon>
              <span class="reset-text">${this.defaultValue}${this.unit}</span>
            </span>
          </t-butt>
          <t-butt
            class="icon"
            .active=${this.disabled}
            .key=${this.key}
            @click=${this._handleDisabledToggle}
            title="Disable ${this.label}"
          >
            <t-icon name="disable"></t-icon>
          </t-butt>
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
            ${this._value}${this.unit}
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
