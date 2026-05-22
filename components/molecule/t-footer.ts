import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-dropdown-button.js';
import '../atom/t-dial.js';
import './t-marker-dialog.js';
import { audio } from '../../services/audio.js';

@customElement('t-footer')
export class BottomNav extends LitElement {
  @property({ type: Boolean }) settingsPanelVisible = false;
  @property({ type: Number }) speed = 100;
  @property({ type: Number }) volume = 75;
  @property({ type: Boolean }) showSpeedDropdown = false;
  @property({ type: Boolean }) showTimeDropdown = false;
  @property({ type: Boolean }) showMarkerDropdown = false;
  @property({ type: String }) markerDialogMode: 'create' | 'edit' = 'create';
  @property({ type: Object }) markerDialogData?: Partial<
    import('../../types/troff.d.js').TroffMarker
  >;
  @property({ type: Number }) markerDialogInitialTime = 0;
  @property({ type: String }) markerDialogSuggestedName = '';
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Boolean }) isStartingPlayback = false;
  @property({ type: Number }) playbackCountdown = 0;
  @property({ type: String }) loopTimesLeftLabel = '';
  @property({ type: Number }) pauseBefore = 3;
  @property({ type: Number }) waitBetween = 1;
  @property({ type: Boolean }) disablePauseBefore = false;
  @property({ type: Boolean }) disableWaitBetween = false;
  @property({ type: Number }) songDuration = 0;

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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

    .speed-dropdown-content,
    .time-dropdown-content {
      padding: 16px 8px;
      border: 1px solid var(--on-theme-color, #ffffff);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: 16px;
    }

    .play-button-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .play-countdown {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 2px;
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
    if (event.target !== event.currentTarget) {
      return;
    }

    this.showMarkerDropdown = event.detail.open;

    if (this.showMarkerDropdown) {
      // Reset to create mode when opening from footer button
      this.markerDialogMode = 'create';
      this.markerDialogData = undefined;

      this.dispatchEvent(
        new CustomEvent('marker-dialog-opened', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  openMarkerDialogForEdit(markerData: Partial<import('../../types/troff.d.js').TroffMarker>) {
    this.markerDialogMode = 'edit';
    this.markerDialogData = { ...markerData };

    if (this.showMarkerDropdown) {
      this.showMarkerDropdown = false;
      requestAnimationFrame(() => {
        this.showMarkerDropdown = true;
      });
      return;
    }

    this.showMarkerDropdown = true;
  }

  private _handleMarkerDialogCompleted() {
    this.showMarkerDropdown = false;
  }

  private _handleMarkerDialogCancelled() {
    this.showMarkerDropdown = false;
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
    this.pauseBefore = event.detail.value;
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
    this.waitBetween = event.detail.value;
    this.dispatchEvent(
      new CustomEvent('wait-between-changed', {
        detail: { waitBetween: this.waitBetween, disabled: this.disableWaitBetween },
        bubbles: true,
        composed: true,
      })
    );
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
                  ? `${this.disableWaitBetween ? 0 : this.waitBetween}`
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
                show-disable-button
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
                show-disable-button
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
              <t-dial
                key="v"
                min="0"
                max="100"
                step="5"
                label="Volume"
                iconName="volume"
                defaultValue="75"
                .value=${this.volume}
                unit=""
                @value-changed=${this._handleVolumeChanged}
              ></t-dial>
              <t-dial
                key="s"
                min="50"
                max="200"
                step="5"
                label="Speed"
                iconName="speed"
                defaultValue="100"
                .value=${this.speed}
                unit="%"
                @value-changed=${this._handleSpeedChanged}
              ></t-dial>
            </div>
          </t-dropdown-button>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'play')}>
          <t-butt round important key=" ">
            <div class="play-button-content">
              ${this.isStartingPlayback
                ? html`<div class="play-countdown">${this.playbackCountdown}</div>`
                : ''}
              <t-icon
                name="${this.isPlaying || this.isStartingPlayback ? 'pause' : 'play'}"
                ?large=${!this.isStartingPlayback}
                ?slim=${this.isStartingPlayback}
              ></t-icon>
            </div>
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
            <t-marker-dialog
              slot="dropdown"
              .mode=${this.markerDialogMode}
              .open=${this.showMarkerDropdown}
              .markerData=${this.markerDialogData}
              .maxTime=${this.songDuration || audio.duration || 0}
              .initialTime=${this.markerDialogInitialTime}
              .suggestedName=${this.markerDialogSuggestedName}
              @dialog-completed=${this._handleMarkerDialogCompleted}
              @dialog-cancelled=${this._handleMarkerDialogCancelled}
            ></t-marker-dialog>
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
