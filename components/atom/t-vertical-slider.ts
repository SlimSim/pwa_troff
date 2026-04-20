import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';

interface Preset {
  label: string;
  value: number;
}

@customElement('t-vertical-slider')
export class VerticalSlider extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      user-select: none;
    }

    .slider-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }

    .slider-track-wrapper {
      position: relative;
      height: 300px;
      width: 60px;
      flex-shrink: 0;
    }

    .slider-track {
      position: absolute;
      left: 20px;
      top: 0;
      bottom: 0;
      width: 4px;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      cursor: pointer;
    }

    .slider-thumb {
      position: absolute;
      left: 50%;
      width: 20px;
      height: 20px;
      background-color: var(--on-theme-color, #ffffff);
      border-radius: 50%;
      cursor: grab;
      transition: box-shadow 0.2s ease;
      z-index: 10;
    }

    .slider-thumb:hover {
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
    }

    .slider-thumb:active {
      cursor: grabbing;
    }

    .presets-container {
      position: relative;
      height: 300px;
      width: 80px;
      flex-shrink: 0;
    }

    .preset-button-wrapper {
      position: absolute;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      transform: translateY(50%);
    }

    .value-display {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--on-theme-color, #ffffff);
      text-align: center;
      min-width: 50px;
      writing-mode: horizontal-tb;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .slider-track-wrapper {
        height: 250px;
      }

      .presets-container {
        height: 250px;
      }
    }
  `;

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) value = 50;
  @property({ type: String }) unit = '';
  @property({ type: Array }) presets: Preset[] = [];

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
    this.value = newValue;
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
    this.value = newValue;
    this._dispatchValueChanged();
  }

  private _handleMouseUp() {
    this.isDragging = false;
  }

  private _handlePresetClick(event: MouseEvent, preset: Preset) {
    event.stopPropagation();
    this.value = preset.value;
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
    const currentPositionPercent = this._getPositionPercent(this.value);
    const displayValue = this.value.toFixed(1);

    return html`
      <div class="slider-container" @click=${(e: Event) => e.stopPropagation()}>
        <div class="slider-track-wrapper" @click=${this._handleTrackClick}>
          <div class="slider-track"></div>

          <!-- Slider thumb -->
          <div
            class="slider-thumb"
            style="left: 50%; bottom: ${currentPositionPercent}%; transform: translateX(-50%) translateY(50%);"
            @mousedown=${this._handleThumbMouseDown}
          ></div>
        </div>

        <!-- Preset buttons on the right -->
        <div class="presets-container">
          ${this.presets.map(
            (preset) => html`
              <div
                class="preset-button-wrapper"
                style="bottom: ${this._getPositionPercent(preset.value)}%;"
              >
                <t-butt
                  .active=${this.value === preset.value}
                  @click=${(e: MouseEvent) => this._handlePresetClick(e, preset)}
                  title=${preset.label}
                >
                  ${preset.label}
                </t-butt>
              </div>
            `
          )}
        </div>

        <div class="value-display">${displayValue}${this.unit}</div>
      </div>
    `;
  }
}
