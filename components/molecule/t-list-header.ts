import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-icon.js';
import './t-header-actions.js';

/**
 * Header for list views (tracks, groups, artists, genres).
 *
 * Renders: title, count (below title, icon + number), and action buttons.
 *
 * All right-side buttons (add, sort, search, etc.) live inside
 * the single `t-header-actions` slotted into the actions slot.
 *
 * @slot actions – Place a `t-header-actions` here (contains all buttons + search).
 */
@customElement('t-list-header')
export class ListHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .song-list-header {
      padding: 16px;
      border-bottom: 1px solid var(--theme-color);
      display: flex;
      align-items: flex-start;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 1;
      background-color: var(--tertiary-color);
    }

    .title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1 1 0%;
      min-width: 80px;
      overflow: hidden;
    }

    .song-list-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
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
      .song-count.search-expanded {
        opacity: 0.8;
        width: auto;
        margin: initial;
        overflow: visible;
        pointer-events: auto;
      }
    }
  `;

  /** Header title (e.g. "Tracks", "Groups", "Artists", "Genres"). */
  @property({ type: String }) title = '';

  /** Number of items to display below the title. */
  @property({ type: Number }) count = 0;

  /** Icon name for the count display. */
  @property({ type: String }) countIcon = 'note';

  /** Whether the search input is focused (drives mobile count collapse). */
  @property({ type: Boolean, reflect: true }) isSearchFocused = false;

  render() {
    const cls = this.isSearchFocused ? 'search-expanded' : '';

    return html`
      <div class="song-list-header">
        <div class="title-group">
          <h3 class="song-list-title">${this.title}</h3>
          <span class="song-count ${cls}">
            <t-icon name=${this.countIcon}></t-icon> ${this.count}
          </span>
        </div>

        <!-- All buttons + search live inside this one t-header-actions element -->
        <slot name="actions"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-list-header': ListHeader;
  }
}
