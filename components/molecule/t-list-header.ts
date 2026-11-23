import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-icon.js';
import '../atom/t-loading.js';
import './t-header-actions.js';

/**
 * Unified header for list views (tracks, groups, artists, genres) and for the
 * detail views inside a group/artist/genre (former t-detail-header).
 *
 * Renders: optional back arrow + icon, title (+ optional syncing badge),
 * optional info text, optional "shared with" text, count below the title,
 * and action buttons.
 *
 * The bar is sticky (top: 0) with an opaque background so rows do not show
 * through it while scrolling.
 *
 * All right-side buttons (add, sort, search, edit, etc.) live inside
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

    .title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1 1 0%;
      min-width: 80px;
      overflow: hidden;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .song-list-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .syncing-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      opacity: 0.7;
      flex-shrink: 0;
      --t-loading-size: 1em;
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
      .song-count.search-expanded {
        opacity: 0.8;
        width: auto;
        margin: initial;
        overflow: visible;
        pointer-events: auto;
      }
    }
  `;

  /** Header title (e.g. "Tracks", "Groups", or a group/artist/genre name). */
  @property({ type: String }) title = '';

  /** Number of items to display below the title. */
  @property({ type: Number }) count = 0;

  /** Icon name for the count display. */
  @property({ type: String }) countIcon = 'note';

  /** Whether the search input is focused (drives mobile count collapse). */
  @property({ type: Boolean, reflect: true }) isSearchFocused = false;

  /** Detail views: render the back arrow (dispatches the `back` event). */
  @property({ type: Boolean }) showBack = false;

  /** Optional entity icon shown to the left of the title (detail views). */
  @property({ type: String }) icon = '';

  /** Whether a background group save/sync is in progress (shows the badge). */
  @property({ type: Boolean }) syncing = false;

  /** Expandable info text below the title (optional, detail views). */
  @property({ type: String }) infoText = '';

  /** Number of shared users (optional, shown as "Shared with N people"). */
  @property({ type: Number }) sharedWithCount = 0;

  /** Background color for the header (e.g. from group.color). */
  @property({ type: String }) headerColor = '';

  /** Text color contrast for the header (e.g. from group.color). */
  @property({ type: String }) headerTextColor = '';

  /** Border color for the header (derived from headerTextColor). */
  @property({ type: String }) headerBorderColor = '';

  /** Whether the info text is expanded. */
  private _infoExpanded = false;

  private _handleInfoToggle(e: Event) {
    this._infoExpanded = !this._infoExpanded;
    // Toggle the class synchronously — the class must flip in the same task
    // as the click (a state-driven re-render would only land on the next
    // microtask). `_infoExpanded` keeps the class stable across re-renders.
    (e.currentTarget as HTMLElement | null)?.classList.toggle('expanded', this._infoExpanded);
  }

  render() {
    const cls = this.isSearchFocused ? 'search-expanded' : '';
    const headerStyle = this.headerColor
      ? `background-color: ${this.headerColor}; color: ${this.headerTextColor}; border-bottom-color: ${this.headerBorderColor || 'transparent'};`
      : '';
    const sharedWithText =
      this.sharedWithCount > 0
        ? `Shared with ${this.sharedWithCount} ${this.sharedWithCount === 1 ? 'person' : 'people'}`
        : '';

    return html`
      <div class="song-list-header" style=${headerStyle}>
        <div class="left-area">
          ${this.showBack || this.icon
            ? html`
                <div class="back-and-icon">
                  ${this.showBack
                    ? html`
                        <span
                          class="back-arrow"
                          @click=${() =>
                            this.dispatchEvent(
                              new CustomEvent('back', { bubbles: true, composed: true })
                            )}
                        >
                          <t-icon name="chevron-up"></t-icon>
                        </span>
                      `
                    : ''}
                  ${this.icon
                    ? html`
                        <div class="detail-icon">
                          <t-icon large name=${this.icon}></t-icon>
                        </div>
                      `
                    : ''}
                </div>
              `
            : ''}

          <div class="title-group">
            <div class="title-row">
              <h3 class="song-list-title">${this.title}</h3>
              ${this.syncing
                ? html`
                    <span class="syncing-badge">
                      <t-loading label="Syncing"></t-loading>
                      syncing
                    </span>
                  `
                : ''}
            </div>
            ${this.infoText
              ? html`
                  <span
                    class="detail-info-text ${this._infoExpanded ? 'expanded' : ''}"
                    @click=${this._handleInfoToggle}
                    title="${this._infoExpanded ? 'Collapse' : 'Expand info'}"
                    >${this.infoText}</span
                  >
                `
              : ''}
            ${sharedWithText ? html`<span class="shared-with">${sharedWithText}</span>` : ''}
            <span class="song-count ${cls}"> # ${this.count} </span>
          </div>
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
