import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';

@customElement('t-dial')
export class Dial extends LitElement {
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
      color: var(--text-color-on-theme);
      font-weight: bold;
      font-size: 0.8rem;
    }

    .dial-knob:hover {
      box-shadow: 0 0 var(--hover-fuzzy) var(--hover-size) var(--theme-color);
    }

    .dial-knob:active {
      cursor: grabbing;
      box-shadow: 0 0 var(--active-fuzzy) var(--active-size) var(--theme-color);
    }

    .indicator {
      position: absolute;
      top: 5px;
      left: 50%;
      width: 2px;
      height: 10px;
      background-color: var(--text-color-on-theme);
      transform: translateX(-50%);
      border-radius: 1px;
    }

    .label {
      margin-bottom: 4px;
      text-align: center;
    }

    .value-display {
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
      min-width: 50px;
      margin-bottom: 8px;
    }

    .value-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  `;

  @property({ type: Number }) value = 1;
  @property({ type: String }) unit = '';
  @property({ type: Number }) defaultValue = 1;
  @property({ type: String }) label = '';
  @property({ type: String }) key = '';

  private isDragging = false;
  private initialValue = 1;
  private justDragged = false;
  private startAngle = 0;
  private currentRotation = 0;
  private accumulatedAngle = 0;

  private _getKnobElement(): HTMLElement | null {
    return this.shadowRoot?.querySelector('.dial-knob') ?? null;
  }

  private _getAngleFromEvent(event: MouseEvent | Touch): number {
    const knob = this._getKnobElement();
    if (!knob) return 0;
    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (event.clientX || (event as Touch).clientX) - centerX;
    const deltaY = (event.clientY || (event as Touch).clientY) - centerY;
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousemove', this._handleMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));
    document.addEventListener('touchmove', this._handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._handleTouchEnd.bind(this));
    document.addEventListener('click', this._handleDocumentClick.bind(this), true); // capture
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this._handleMouseUp.bind(this));
    document.removeEventListener('touchmove', this._handleTouchMove.bind(this));
    document.removeEventListener('touchend', this._handleTouchEnd.bind(this));
    document.removeEventListener('click', this._handleDocumentClick.bind(this), true);
  }

  private _handleStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.isDragging = true;
    const touch = (event as TouchEvent).touches?.[0] || (event as MouseEvent);
    this.startAngle = this._getAngleFromEvent(touch);
    this.initialValue = this.value;
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
    this.value = newValue;

    // Update initialValue when hitting min
    if (this.value === 0) {
      this.initialValue = 0;
    }

    // Reset accumulation if negative at min
    if (this.value === 0 && this.accumulatedAngle < 0) {
      this.accumulatedAngle = 0;
    }

    this.startAngle = currentAngle;
    this.requestUpdate();
  }

  private _handleEnd() {
    this.isDragging = false;
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
    this.value = this.defaultValue;
    this.currentRotation = 0;
    this.accumulatedAngle = 0;
    this._dispatchValueChanged();
  }

  private _handleIncrement() {
    this.value = Math.max(0, this.value + 1);
    this._dispatchValueChanged();
  }

  private _handleDecrement() {
    this.value = Math.max(0, this.value - 1);
    this._dispatchValueChanged();
  }

  private _dispatchValueChanged() {
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      ${this.label ? html`<p class="label">${this.label}</p>` : ''}
      <div class="value-display">${this.value}${this.unit}</div>
      <div class="dial-container">
        <div
          class="dial-knob"
          style="transform: rotate(${this.currentRotation}deg);"
          @mousedown=${this._handleMouseDown}
          @touchstart=${this._handleTouchStart}
        >
          <div class="indicator"></div>
        </div>
      </div>
      <t-butt
        .active=${this.value === this.defaultValue}
        .key=${this.key}
        @click=${(e: MouseEvent) => this._handleDefaultClick(e)}
        title="${this.defaultValue}"
      >
        ${this.defaultValue}${this.unit}
      </t-butt>
      <div class="value-controls">
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
          class="icon"
          .key=${this.key}
          shift
          @click=${this._handleIncrement}
          title="Increase by 1"
        >
          +
        </t-butt>
      </div>
    `;
  }
}
