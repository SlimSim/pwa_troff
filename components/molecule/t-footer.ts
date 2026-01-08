import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('t-footer')
export class BottomNav extends LitElement {
  @property({ type: Boolean }) settingsPanelVisible = false;
  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background-color: var(--theme-color, #003366);
      /* box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3); */
      // todo: have box-shadow ONLY when the body is scrollable, not the host
    }

    .nav-container {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 8px 0;
      max-width: 600px;
      margin: 0 auto;
      /* position: relative; */
    }

    /* .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      /* height: 60px; * /
    } */

    /* .nav-item t-butt {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    } */

    /* .play-button-wrapper t-icon {
      font-size: 2rem;
      color: white;
    } */

    .nav-item t-icon {
      transition: transform 0.3s ease-in-out;
      transform-style: preserve-3d;
    }

    .nav-item t-icon.flipped {
      transform: rotateX(180deg) translateY(-4px);
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

  render() {
    return html`
      <div class="nav-container">
        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'songs')}>
          <t-butt icon>
            <t-icon name="time" label="3" unit="s"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'settings')}>
          <t-butt icon>
            <t-icon name="speed" label="100" unit="%"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'play')}>
          <t-butt round important>
            <t-icon name="play"></t-icon>
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
