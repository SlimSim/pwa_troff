import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import '../atom/t-dropdown-button.js';
import '../atom/t-vertical-slider.js';
import '../atom/t-dial.js';
import '../atom/t-time-input.js';
import '../atom/t-input.js';
import '../atom/t-textarea.js';
import '../atom/t-color-picker.js';
import type { TInput } from '../atom/t-input.js';
import type { TTextarea } from '../atom/t-textarea.js';
import { audio } from '../../services/audio.js';

@customElement('t-footer')
export class BottomNav extends LitElement {
  @property({ type: Boolean }) settingsPanelVisible = false;
  @property({ type: Number }) speed = 100;
  @property({ type: Number }) volume = 75;
  @property({ type: Boolean }) showSpeedDropdown = false;
  @property({ type: Boolean }) showTimeDropdown = false;
  @property({ type: Boolean }) showMarkerDropdown = false;
  @property({ type: Number }) markerTime = 0;
  @property({ type: String }) markerName = '';
  @property({ type: String }) markerInfo = '';
  @property({ type: String }) markerColor = '';
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Number }) pauseBefore = 3;
  @property({ type: Number }) waitBetween = 1;
  @property({ type: Boolean }) disablePauseBefore = false;
  @property({ type: Boolean }) disableWaitBetween = false;

  @query('.marker-dropdown-content t-input')
  private _markerNameInput?: TInput;
  @query('.marker-dropdown-content t-textarea')
  private _markerInfoInput?: TTextarea;
  private _boundMarkerDropdownKeyHandler?: (event: KeyboardEvent) => void;

  connectedCallback() {
    super.connectedCallback();
    this._boundMarkerDropdownKeyHandler = (event: KeyboardEvent) =>
      this._handleMarkerDropdownKeyboardShortcut(event);
    document.addEventListener('keydown', this._boundMarkerDropdownKeyHandler, {
      capture: true,
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._boundMarkerDropdownKeyHandler) {
      document.removeEventListener('keydown', this._boundMarkerDropdownKeyHandler, {
        capture: true,
      });
      this._boundMarkerDropdownKeyHandler = undefined;
    }
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      background-color: var(--theme-color, #003366);
      z-index: 1000;
      padding: 5px var(--container-padding-x);
      /* box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3); */
      // todo: have box-shadow ONLY when the body is scrollable, not the host
    }

    .nav-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0;
      max-width: 600px;
      margin: 0 auto;
    }

    .nav-item t-icon {
      transition: transform 0.3s ease-in-out;
      transform-style: preserve-3d;
    }

    .nav-item t-icon.flipped {
      transform: rotateX(180deg) translateY(-1px);
    }

    .speed-dropdown-content {
      padding: 16px 8px;
      border: 1px solid var(--on-theme-color, #ffffff);
      border-radius: 4px;
      display: flex;
      flex-direction: row;
      gap: 16px;
    }
    .time-dropdown-content {
      padding: 16px 8px;
      border: 1px solid var(--on-theme-color, #ffffff);
      border-radius: 4px;
      display: flex;
      flex-direction: row;
      gap: 16px;
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
    .marker-dropdown-content t-butt {
      align-self: flex-end;
    }
  `;

  private _handleNavClick(event: Event, action: string) {
    event.stopPropagation();

    if (action === 'info') {
      this.settingsPanelVisible = !this.settingsPanelVisible;
      this.dispatchEvent(
        new CustomEvent('settings-toggle', {
          detail: { visible: this.settingsPanelVisible },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('nav-click', {
          detail: { action },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleSpeedDropdownToggled(event: CustomEvent) {
    this.showSpeedDropdown = event.detail.open;
  }

  private _handleTimeDropdownToggled(event: CustomEvent) {
    this.showTimeDropdown = event.detail.open;
  }

  private _handleMarkerDropdownToggled(event: CustomEvent) {
    this.showMarkerDropdown = event.detail.open;

    if (this.showMarkerDropdown) {
      // Capture current time
      try {
        this.markerTime = audio && audio.currentTime ? audio.currentTime : 0;
      } catch (error) {
        console.warn('Could not capture audio time:', error);
        this.markerTime = 0;
      }

      this.markerName = '';
      this.markerInfo = '';
      this.markerColor = '';

      this.dispatchEvent(
        new CustomEvent('marker-dialog-opened', {
          bubbles: true,
          composed: true,
        })
      );

      void this._focusAndSelectMarkerNameInput();
    }
  }

  private _getMarkerNativeInput() {
    const input = this._markerNameInput;
    if (!input) return undefined;
    const nativeInput = input.shadowRoot?.querySelector('input');
    return nativeInput instanceof HTMLInputElement ? nativeInput : undefined;
  }

  private _focusAndSelectMarkerNameInputAttempt(source: string, attempt: number) {
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

    requestAnimationFrame(() => {
      this._focusAndSelectMarkerNameInputAttempt('raf', 1);
    });

    setTimeout(() => this._focusAndSelectMarkerNameInputAttempt('timeout', 2), 0);
    setTimeout(() => this._focusAndSelectMarkerNameInputAttempt('timeout', 3), 50);
    setTimeout(() => this._focusAndSelectMarkerNameInputAttempt('timeout', 4), 150);
  }

  private _handleMarkerDropdownKeyboardShortcut(event: KeyboardEvent) {
    if (!this.showMarkerDropdown) return;
    if (event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.showMarkerDropdown = false;
      return;
    }

    if (event.key !== 'Enter') return;

    event.preventDefault();
    event.stopPropagation();
    this._handleMarkerOkClick();
  }

  protected override updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has('showMarkerDropdown') && this.showMarkerDropdown) {
      void this._focusAndSelectMarkerNameInput();
    }
  }

  private _handleSpeedChanged(event: CustomEvent) {
    this.speed = event.detail.value;
    this.dispatchEvent(
      new CustomEvent('speed-changed', {
        detail: { speed: this.speed },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleVolumeChanged(event: CustomEvent) {
    this.volume = event.detail.value;
    this.dispatchEvent(
      new CustomEvent('volume-changed', {
        detail: { volume: this.volume },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handlePauseBeforeChanged(event: CustomEvent) {
    this.disablePauseBefore = event.detail.disabled;
    if (this.disablePauseBefore) {
      this.pauseBefore = 0;
    } else {
      this.pauseBefore = event.detail.value;
    }
    this.dispatchEvent(
      new CustomEvent('pause-before-changed', {
        detail: { pauseBefore: event.detail.value, disabled: this.disablePauseBefore },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleWaitBetweenChanged(event: CustomEvent) {
    this.disableWaitBetween = event.detail.disabled;
    if (this.disableWaitBetween) {
      this.waitBetween = 0;
    } else {
      this.waitBetween = event.detail.value;
    }
    this.dispatchEvent(
      new CustomEvent('wait-between-changed', {
        detail: { waitBetween: this.waitBetween, disabled: this.disableWaitBetween },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleMarkerNameChange(event: CustomEvent) {
    if (typeof event.detail?.value === 'string') {
      this.markerName = event.detail.value;
    }
  }

  private _handleMarkerColorChange(event: CustomEvent) {
    this.markerColor = event.detail.name || '';
  }

  private _handleMarkerInfoChange(event: CustomEvent) {
    if (typeof event.detail?.value === 'string') {
      this.markerInfo = event.detail.value;
    }
  }

  private _handleMarkerTimeChange(event: CustomEvent) {
    this.markerTime = event.detail.value || 0;
  }

  private _handleMarkerOkClick() {
    const currentName = this._markerNameInput?.value ?? this.markerName;
    const currentInfo = this._markerInfoInput?.value ?? this.markerInfo;

    if (!currentName || !currentName.trim()) {
      console.warn('Marker name is required');
      return;
    }

    // Create marker object
    const marker = {
      id: Date.now().toString(), // Simple unique ID
      name: currentName.trim(),
      info: currentInfo,
      time: this.markerTime,
      color: this.markerColor || '', // Default color if none selected
      createdAt: new Date().toISOString(),
    };

    // Dispatch event to let v2Script handle saving and UI updates
    this.dispatchEvent(
      new CustomEvent('marker-created', {
        detail: { marker },
        bubbles: true,
        composed: true,
      })
    );

    // Reset form and close dropdown
    this.markerName = '';
    this.markerInfo = '';
    this.markerColor = '';
    this.showMarkerDropdown = false;
  }

  render() {
    return html`
      <div class="nav-container">
        <div class="nav-item">
          <t-dropdown-button
            position="up"
            align="left"
            .open=${this.showTimeDropdown}
            @dropdown-toggled=${this._handleTimeDropdownToggled}
          >
            <t-butt slot="button" title="Wait control">
              <t-icon
                name="time"
                label="${this.isPlaying
                  ? `${this.waitBetween}`
                  : `${this.disablePauseBefore ? 0 : this.pauseBefore}`}"
                unit="s"
              ></t-icon>
            </t-butt>
            <div slot="dropdown" class="time-dropdown-content">
              <t-dial
                key="p"
                label="Pause before"
                iconName="pause-before"
                unit="s"
                defaultValue="3"
                .value=${this.pauseBefore}
                .disabled=${this.disablePauseBefore}
                @value-changed=${this._handlePauseBeforeChanged}
              ></t-dial>
              <t-dial
                key="w"
                label="Wait between"
                iconName="wait-between"
                unit="s"
                defaultValue="1"
                .value=${this.waitBetween}
                .disabled=${this.disableWaitBetween}
                @value-changed=${this._handleWaitBetweenChanged}
              ></t-dial>
            </div>
          </t-dropdown-button>
        </div>

        <div class="nav-item">
          <t-dropdown-button
            position="up"
            align="left"
            .open=${this.showSpeedDropdown}
            @dropdown-toggled=${this._handleSpeedDropdownToggled}
          >
            <t-butt icon slot="button" title="Speed control">
              <t-icon name="speed" label="${Math.round(this.speed)}" unit="%"></t-icon>
            </t-butt>
            <div slot="dropdown" class="speed-dropdown-content">
              <t-vertical-slider
                key="v"
                min="0"
                max="100"
                label="Volume"
                iconName="volume"
                defaultValue="75"
                .value=${this.volume}
                unit=""
                @value-changed=${this._handleVolumeChanged}
              ></t-vertical-slider>
              <t-vertical-slider
                key="s"
                min="50"
                max="200"
                label="Speed"
                iconName="speed"
                defaultValue="100"
                .value=${this.speed}
                unit="%"
                @value-changed=${this._handleSpeedChanged}
              ></t-vertical-slider>
            </div>
          </t-dropdown-button>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'play')}>
          <t-butt round important key=" ">
            <t-icon large name="${this.isPlaying ? 'pause' : 'play'}"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'states')}>
          <t-dropdown-button
            position="up"
            align="right"
            .open=${this.showMarkerDropdown}
            @dropdown-toggled=${this._handleMarkerDropdownToggled}
          >
            <t-butt key="m" icon slot="button">
              <t-icon name="marker-plus"></t-icon>
            </t-butt>
            <div slot="dropdown" class="marker-dropdown-content">
              <div class="marker-text">Add a marker</div>
              <t-input
                label="Name"
                placeholder="Enter Name of marker"
                helper-text="Enter a name for the marker"
                .value=${this.markerName}
                @input=${this._handleMarkerNameChange}
              ></t-input>
              <t-textarea
                label="Info"
                placeholder="Put extra marker info here"
                helper-text="You can add multiple lines"
                .value=${this.markerInfo}
                rows="4"
                @input=${this._handleMarkerInfoChange}
              ></t-textarea>
              <t-time-input
                key="m"
                label="Time"
                unit="s"
                defaultValue="0"
                .value=${this.markerTime}
                @value-changed=${this._handleMarkerTimeChange}
              ></t-time-input>
              <t-color-picker @change=${this._handleMarkerColorChange}></t-color-picker>
              <t-butt important @click=${this._handleMarkerOkClick}>OK</t-butt>
            </div>
          </t-dropdown-button>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'info')}>
          <t-butt icon>
            <t-icon
              name="chevron-up"
              class="${this.settingsPanelVisible ? 'flipped' : ''}"
            ></t-icon>
          </t-butt>
        </div>
      </div>
    `;
  }
}
