import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-dropdown-button.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-textarea.js';

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
      overflow: hidden;
    }

    .artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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

    .status-stack {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1;
      flex-shrink: 0;
    }

    .status-countdown {
      min-height: 0.9rem;
    }

    .status-loops {
      min-height: 0.9rem;
      opacity: 0.9;
    }

    .info-dropdown-content {
      padding: 16px 8px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      width: min(280px, calc(100vw - 24px));
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
  @property({ type: String }) albumArt = '';
  @property({ type: String }) currentTime = '0:00';
  @property({ type: String }) totalTime = '0:00';
  @property({ type: String }) statusCountdown = '';
  @property({ type: String }) statusLoopsLeft = '';
  @property({ type: Boolean, reflect: true }) expanded = false;
  @property({ type: String }) songInfo = '';

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

  private _handleInfoInput(event: CustomEvent) {
    if (typeof event.detail?.value === 'string') {
      this.songInfo = event.detail.value;
      this._handleInfoSave();
    }
  }

  private _handleInfoSave() {
    this.dispatchEvent(
      new CustomEvent('song-info-saved', {
        detail: { info: this.songInfo },
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
            ${this.albumArt ? html`<img src="${this.albumArt}" alt="Album art" />` : html`♪`}
          </div>
        </div>

        <div class="song-info">
          <div class="song-title">${this.songTitle}</div>
          <div class="artist-name">${this.artistName}</div>
          <div class="time-info">${this.currentTime} / ${this.totalTime}</div>
        </div>

        <t-dropdown-button position="down" align="right" class="info-dropdown">
          <t-butt ghost slot="button" title="Song info">
            <t-icon name="info"></t-icon>
          </t-butt>
          <div slot="dropdown" class="info-dropdown-content">
            <t-textarea
              label="Song info"
              placeholder="Song specific info here!"
              rows="12"
              .value=${this.songInfo}
              @input=${this._handleInfoInput}
            ></t-textarea>
          </div>
        </t-dropdown-button>
        <div class="status-stack">
          <div class="status-countdown">${this.statusCountdown}</div>
          <div class="status-loops">${this.statusLoopsLeft}</div>
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
