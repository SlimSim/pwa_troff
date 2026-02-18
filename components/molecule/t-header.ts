import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('t-header')
export class Header extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      background-color: var(--theme-color, #003366);
      color: var(--on-theme-color, #ffffff);
      border-bottom: 1px solid var(--border-color, #333);
      z-index: 1000;
      padding: 10px var(--container-padding-x);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      user-select: none;
    }

    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 600px;
      margin: 0 auto;
      position: relative;
    }

    .artwork-section {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .artwork {
      width: 40px;
      height: 40px;
      background-color: var(--item-background, rgba(255, 255, 255, 0.1));
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-color, #000);
      font-size: 16px;
      font-weight: bold;
    }

    .song-info {
      flex: 1;
      margin-left: 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }

    .song-title {
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .artist-name {
      font-size: 0.8rem;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .time-info {
      font-size: 0.7rem;
      margin-top: 2px;
    }

    .expand-section {
      position: absolute;
      bottom: -9px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .expand-section t-icon {
      transform: rotateX(180deg) translateY(-2px);
      transition: transform 0.3s ease-in-out;
      transform-style: preserve-3d;
    }

    .expand-section t-icon.expanded {
      transform: none;
    }
  `;

  @property({ type: String }) songTitle = 'Unknown Song';
  @property({ type: String }) artistName = 'Unknown Artist';
  @property({ type: String }) currentTime = '0:00';
  @property({ type: String }) totalTime = '0:00';
  @property({ type: Boolean, reflect: true }) expanded = false;

  private _handleExpand() {
    this.expanded = !this.expanded;
    this.dispatchEvent(
      new CustomEvent('header-expand', {
        detail: { expanded: this.expanded },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="header-container" @click=${this._handleExpand}>
        <div class="artwork-section">
          <div class="artwork">
            <!-- Placeholder for album artwork -->
            ♪
          </div>
        </div>

        <div class="song-info">
          <div class="song-title">${this.songTitle}</div>
          <div class="artist-name">${this.artistName}</div>
          <div class="time-info">${this.currentTime} / ${this.totalTime}</div>
        </div>

        <div
          class="expand-section"
          @click=${(e: Event) => {
            e.stopPropagation();
            this._handleExpand();
          }}
        >
          <t-icon name="chevron-up" class="${this.expanded ? 'expanded' : ''}"></t-icon>
        </div>
      </div>
    `;
  }
}
