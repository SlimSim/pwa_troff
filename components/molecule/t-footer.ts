import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('t-footer')
export class BottomNav extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background-color: var(--body-background, #bccbde);
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

    /* @media (min-width: 768px) {
      .nav-container {
        max-width: 800px;
      }

      .nav-item {
        height: 70px;
      }

      .play-button-wrapper t-butt {
        width: 80px;
        height: 80px;
      }

      .play-button-wrapper t-icon {
        font-size: 2.5rem;
      }
    } */
  `;

  private _handleNavClick(event: Event, action: string) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('nav-click', {
        detail: { action },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="nav-container">
        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'songs')}>
          <t-butt icon>
            <t-icon name="share"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'settings')}>
          <t-butt icon>
            <t-icon name="share"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'play')}>
          <t-butt round important>
            <t-icon name="play"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'states')}>
          <t-butt icon>
            <t-icon name="share"></t-icon>
          </t-butt>
        </div>

        <div class="nav-item" @click=${(e: Event) => this._handleNavClick(e, 'info')}>
          <t-butt icon>
            <t-icon name="share"></t-icon>
          </t-butt>
        </div>
      </div>
    `;
  }
}
