import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import './t-header-actions.js';

/**
 * Header for detail views (inside a group, artist, or genre).
 *
 * Renders: back arrow, optional icon, title, optional info text,
 * optional "shared with" text, count (below title), and actions.
 *
 * All right-side buttons (add, sort, search, edit, etc.) live inside
 * the single `t-header-actions` slotted into the actions slot.
 *
 * @slot actions – Place a `t-header-actions` here (contains all buttons + search).
 */
@customElement('t-detail-header')
export class DetailHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--list-border-color, rgba(255, 255, 255, 0.1));
      background-color: var(--list-hover-bg, rgba(255, 255, 255, 0.05));
    }

    .back-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .back-arrow t-icon {
      transform: rotate(-90deg);
      font-size: 1.3rem;
    }

    .detail-icon {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .left-area {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex: 1 1 0%;
      min-width: 120px;
      overflow: hidden;
    }

    .back-and-icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .detail-title-group {
      flex: 1 1 0%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
      overflow: hidden;
    }

    .detail-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }

    .detail-info-text {
      font-size: 0.7rem;
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.3;
      transition: opacity 0.15s;
    }

    .detail-info-text:hover {
      opacity: 0.9;
    }

    .detail-info-text.expanded {
      white-space: normal;
      overflow: visible;
    }

    .shared-with {
      font-size: 0.65rem;
      opacity: 0.5;
      line-height: 1.2;
    }

    .song-count {
      font-size: 0.85rem;
      opacity: 0.8;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 3px;
      transition:
        opacity 0.2s ease,
        width 0.2s ease,
        margin 0.2s ease;
      flex-shrink: 0;
    }

    .song-count.search-expanded {
      opacity: 0;
      width: 0;
      margin: 0;
      overflow: hidden;
      pointer-events: none;
    }

    @media (min-width: 576px) {
      .detail-header {
        padding: 14px 20px;
      }

      .detail-title {
        font-size: 1.1rem;
      }

      .song-count.search-expanded {
        opacity: 0.8;
        width: auto;
        margin: initial;
        overflow: visible;
        pointer-events: auto;
      }
    }
  `;

  /** Entity name displayed as the title. */
  @property({ type: String }) entityName = '';

  /** Icon name for the entity (optional, shown to the left of the title). */
  @property({ type: String }) icon = '';

  /** Expandable info text below the title (optional). */
  @property({ type: String }) infoText = '';

  /** Number of shared users (optional, shown as "Shared with N people"). */
  @property({ type: Number }) sharedWithCount = 0;

  /** Label for the song/entity count (e.g. "songs"). */
  @property({ type: String }) countLabel = '';

  /** Number of songs/entities to display. */
  @property({ type: Number }) count = 0;

  /** Background color for the header (e.g. from group.color). */
  @property({ type: String }) headerColor = '';

  /** Text color contrast for the header (e.g. from group.color). */
  @property({ type: String }) headerTextColor = '';

  /** Border color for the header (derived from headerTextColor). */
  @property({ type: String }) headerBorderColor = '';

  /** Whether the search input is focused (drives mobile count collapse). */
  @property({ type: Boolean, reflect: true }) isSearchFocused = false;

  /** Whether the info text is expanded. */
  private _infoExpanded = false;

  private _handleInfoToggle() {
    this._infoExpanded = !this._infoExpanded;
    this.requestUpdate();
  }

  render() {
    const cls = this.isSearchFocused ? 'search-expanded' : '';
    const headerStyle =
      this.headerColor
        ? `background-color: ${this.headerColor}; color: ${this.headerTextColor}; border-bottom-color: ${this.headerBorderColor || 'transparent'};`
        : '';

    return html`
      <div class="detail-header" style=${headerStyle}>
        <div class="left-area">
          <div class="back-and-icon">
            <span class="back-arrow" @click=${() => this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }))}>
              <t-icon name="chevron-up"></t-icon>
            </span>

            ${this.icon
              ? html`<div class="detail-icon">
                  <t-icon large name=${this.icon}></t-icon>
                </div>`
              : ''}
          </div>

          <div class="detail-title-group">
            <h2 class="detail-title">${this.entityName}</h2>
            ${this.infoText
              ? html`<span
                  class="detail-info-text ${this._infoExpanded ? 'expanded' : ''}"
                  @click=${this._handleInfoToggle}
                  title="${this._infoExpanded ? 'Collapse' : 'Expand info'}"
                  >${this.infoText}</span
                >`
              : ''}
            ${this.sharedWithCount > 0
              ? html`<span class="shared-with"
                  >Shared with ${this.sharedWithCount}
                  ${this.sharedWithCount === 1 ? 'person' : 'people'}</span
                >`
              : ''}
            ${this.countLabel
              ? html`
                  <span class="song-count ${cls}">
                    <t-icon name="note"></t-icon> ${this.count}
                  </span>
                `
              : ''}
          </div>
        </div>

        <!-- Actions (all buttons + search live inside this one element) -->
        <slot name="actions"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-detail-header': DetailHeader;
  }
}
