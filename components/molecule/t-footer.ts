import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-dropdown-button.js';
import '../atom/t-vertical-slider.js';
import '../atom/t-dial.js';

@customElement('t-footer')
export class BottomNav extends LitElement {
  @property({ type: Boolean }) settingsPanelVisible = false;
  @property({ type: Number }) speed = 100;
  @property({ type: Number }) volume = 75;
  @property({ type: Boolean }) showSpeedDropdown = false;
  @property({ type: Boolean }) showTimeDropdown = false;
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Number }) pauseBefore = 3;
  @property({ type: Number }) waitBetween = 3;
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
    this.pauseBefore = event.detail.value;
    this.dispatchEvent(
      new CustomEvent('pause-before-changed', {
        detail: { pauseBefore: this.pauseBefore },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleWaitBetweenChanged(event: CustomEvent) {
    this.waitBetween = event.detail.value;
    this.dispatchEvent(
      new CustomEvent('wait-between-changed', {
        detail: { waitBetween: this.waitBetween },
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
              <t-icon name="time" label="3" unit="s"></t-icon>
            </t-butt>
            <div slot="dropdown" class="time-dropdown-content">
              <t-dial
                key="p"
                label="Pause before"
                unit="s"
                defaultValue="3"
                .value=${this.pauseBefore}
                @value-changed=${this._handlePauseBeforeChanged}
              ></t-dial>
              <t-dial
                key="w"
                label="Wait between"
                unit="s"
                defaultValue="1"
                .value=${this.waitBetween}
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
          <t-butt icon>
            <t-icon name="marker-plus"></t-icon>
          </t-butt>
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
