import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { TroffMarker } from '../../types/troff.js';
import '../atom/t-butt.js';
import '../molecule/t-marker.js';

@customElement('t-marker-slider')
export class MarkerSlider extends LitElement {
  static styles = css`
    :host {
      padding: 0;
      display: inline-block;
      user-select: none;
      height: 100%;
      width: 100%;
    }

    .slider-container {
      margin: calc(var(--button-height) / 2) 0;

      display: flex;
      padding: var(--slider-top-padding) 0;
      flex-direction: row;
      align-items: center;
      gap: 0;
    }

    .slider-track-wrapper {
      padding: 0 var(--slider-horizontal-padding);
      position: relative;
      height: 100%;
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

    .presets-container {
      position: relative;
      height: 100%;
      flex-grow: 1;
      display: flex;
      width: 100%;
    }
  `;

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) value = 50;
  @property({ type: String }) unit = '';
  @property({ type: Array }) markers: TroffMarker[] = [];
  @property({ type: Number }) zoomLevel = 1;
  @property({ type: Number }) minZoom = 1;

  private isDragging = false;
  private isPinching = false;
  private initialPinchDistance = 0;
  private initialZoom = 1;

  private _getTrackElement(): HTMLElement | null {
    return this.shadowRoot?.querySelector('.slider-track-wrapper') ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousemove', this._handleMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));
    this.addEventListener('wheel', this._handleWheel.bind(this));
    this.addEventListener('touchstart', this._handleTouchStart.bind(this));
    this.addEventListener('touchmove', this._handleTouchMove.bind(this));
    this.addEventListener('touchend', this._handleTouchEnd.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this._handleMouseUp.bind(this));
    this.removeEventListener('wheel', this._handleWheel.bind(this));
    this.removeEventListener('touchstart', this._handleTouchStart.bind(this));
    this.removeEventListener('touchmove', this._handleTouchMove.bind(this));
    this.removeEventListener('touchend', this._handleTouchEnd.bind(this));
  }

  private _getPositionPercent(val: number): number {
    return ((this.max - val) / (this.max - this.min)) * 100;
  }

  private _getValueFromPosition(positionPercent: number): number {
    const rawValue = (1 - positionPercent / 100) * (this.max - this.min) + this.min;
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

  private _handleMarkerClick(event: CustomEvent, marker: TroffMarker) {
    event.stopPropagation();
    this.value = Math.round(Number(marker.time));
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

  private _handleWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      this._setZoom(this.zoomLevel * delta);
    }
  }

  private _handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      this.isPinching = true;
      this.initialPinchDistance = this._getDistance(event.touches[0], event.touches[1]);
      this.initialZoom = this.zoomLevel;
    }
  }

  private _handleTouchMove(event: TouchEvent) {
    if (this.isPinching && event.touches.length === 2) {
      event.preventDefault();

      const currentDistance = this._getDistance(event.touches[0], event.touches[1]);
      const scale = currentDistance / this.initialPinchDistance;
      this._setZoom(this.initialZoom * scale);
    }
  }

  private _handleTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      this.isPinching = false;
    }
  }

  private _getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private _setZoom(newZoom: number) {
    this.zoomLevel = Math.max(this.minZoom, newZoom);
    this.requestUpdate();
  }

  render() {
    const currentPositionPercent = this._getPositionPercent(this.value);

    return html`
      <div
        class="slider-container"
        style="height: calc(calc(100% * ${this
          .zoomLevel}) - var(--button-height) - calc(2 * var(--slider-top-padding)));"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="slider-track-wrapper" @click=${this._handleTrackClick}>
          <div class="slider-track"></div>

          <!-- Slider thumb -->
          <div
            class="slider-thumb"
            style="bottom: ${currentPositionPercent}%; transform: translateX(-50%) translateY(50%);"
            @mousedown=${this._handleThumbMouseDown}
          ></div>
        </div>

        <!-- Marker buttons on the right -->
        <div class="presets-container">
          ${this.markers.map(
            (marker) => html`
              <t-marker
                class="preset-marker"
                style="position: absolute; bottom: ${this._getPositionPercent(
                  Number(marker.time)
                )}%;"
                .marker=${{ label: marker.name, value: Number(marker.time) }}
                .active=${this.value === Number(marker.time)}
                @marker-click=${(e: CustomEvent) => this._handleMarkerClick(e, marker)}
              ></t-marker>
            `
          )}
        </div>
      </div>
    `;
  }
}
