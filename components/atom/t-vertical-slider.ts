import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';

@customElement('t-vertical-slider')
export class VerticalSlider extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      user-select: none;
      align-items: center;
    }

    .slider-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      padding: 8px;
    }

    .slider-track-wrapper {
      position: relative;
      height: 300px;
      width: max(var(--slider-thumb-size), var(--slider-track-width));
      flex-shrink: 0;
    }

    .slider-track {
      position: absolute;
      left: calc(50% - var(--slider-track-width) / 2);
      top: 0;
      bottom: 0;
      width: var(--slider-track-width);
      background-color: color-mix(in srgb, var(--theme-color) 25%, transparent);
      border-radius: 2px;
      cursor: pointer;
    }

    .slider-thumb {
      position: absolute;
      left: 50%;
      width: var(--slider-thumb-size);
      height: var(--slider-thumb-size);
      background-color: var(--theme-color);
      border-radius: 50%;
      cursor: grab;
      transition: box-shadow 0.2s ease;
      z-index: 10;
    }

    .slider-thumb:hover {
      box-shadow: 0 0 var(--hover-fuzzy) var(--hover-size) var(--theme-color);
    }

    .slider-thumb:active {
      cursor: grabbing;

      box-shadow: 0 0 var(--active-fuzzy) var(--active-size) var(--theme-color);
    }

    .label {
      margin-bottom: 4px;
      margin-top: 0;
    }

    .value-display {
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
      min-width: 50px;
      writing-mode: horizontal-tb;
    }
    .value-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .value-display {
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
      min-width: 50px;
      writing-mode: horizontal-tb;
    }
  `;

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) value = 50;
  @property({ type: String }) unit = '';
  @property({ type: Number }) defaultValue = 50;
  @property({ type: String }) label = '';
  @property({ type: String }) key = '';

  private isDragging = false;

  private _getTrackElement(): HTMLElement | null {
    return this.shadowRoot?.querySelector('.slider-track-wrapper') ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousemove', this._handleMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this._handleMouseUp.bind(this));
  }

  private _getPositionPercent(val: number): number {
    return ((val - this.min) / (this.max - this.min)) * 100;
  }

  private _getValueFromPosition(positionPercent: number): number {
    const rawValue = (positionPercent / 100) * (this.max - this.min) + this.min;
    // Clamp to min/max
    return Math.max(this.min, Math.min(this.max, rawValue));
  }

  private _handleTrackClick(event: MouseEvent) {
    event.stopPropagation();
    const trackWrapper = this._getTrackElement();
    if (!trackWrapper) return;

    const rect = trackWrapper.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const positionPercent = (1 - clickY / rect.height) * 100;

    const newValue = this._getValueFromPosition(positionPercent);
    this.value = Math.round(newValue);
    this._dispatchValueChanged();
  }

  private _handleThumbMouseDown(event: MouseEvent) {
    this.isDragging = true;
    event.preventDefault();
  }

  private _handleMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    const trackWrapper = this._getTrackElement();
    if (!trackWrapper) return;

    const rect = trackWrapper.getBoundingClientRect();
    const moveY = event.clientY - rect.top;
    const positionPercent = Math.max(0, Math.min(100, (1 - moveY / rect.height) * 100));

    const newValue = this._getValueFromPosition(positionPercent);
    this.value = Math.round(newValue);
    this._dispatchValueChanged();
  }

  private _handleMouseUp() {
    this.isDragging = false;
  }

  private _handleDefaultClick(event: MouseEvent) {
    event.stopPropagation();
    this.value = this.defaultValue;
    this._dispatchValueChanged();
  }

  private _handleIncrement() {
    const step = 5;
    const newValue = Math.min(this.max, this.value + step);
    this.value = Math.round(newValue);
    this._dispatchValueChanged();
  }
  private _handleDecrement() {
    const step = 5;
    const newValue = Math.max(this.min, this.value - step);
    this.value = Math.round(newValue);
    this._dispatchValueChanged();
  }

  private _dispatchValueChanged() {
    this.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: Math.round(this.value) },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const currentPositionPercent = this._getPositionPercent(this.value);
    const displayValue = this.value;

    return html`
      ${this.label ? html`<p class="label">${this.label}</p>` : ''}
      <div class="value-display">${displayValue}${this.unit}</div>
      <div class="slider-container" @click=${(e: Event) => e.stopPropagation()}>
        <div class="slider-track-wrapper" @click=${this._handleTrackClick}>
          <div class="slider-track"></div>
          <!-- Slider thumb -->
          <div
            class="slider-thumb"
            style="bottom: ${currentPositionPercent}%; transform: translateX(-50%) translateY(50%);"
            @mousedown=${this._handleThumbMouseDown}
          ></div>
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
      <div class="value-controls" @click=${(e: Event) => e.stopPropagation()}>
        <t-butt
          class="icon"
          .key=${this.key}
          alt
          @click=${this._handleDecrement}
          title="Decrease by 5%"
        >
          −
        </t-butt>
        <t-butt
          class="icon"
          .key=${this.key}
          shift
          @click=${this._handleIncrement}
          title="Increase by 5%"
        >
          +
        </t-butt>
      </div>
    `;
  }
}
