import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-number-label.js';

@customElement('t-media')
export class MediaItem extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .media-container {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .media-container:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .media-container.active {
      background-color: rgba(255, 255, 255, 0.2);
    }

    /* Album Art Section */
    .album-art {
      width: 48px;
      height: 48px;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--on-theme-color, #ffffff);
      font-size: 1.2rem;
      opacity: 0.7;
    }

    /* Info Column */
    .info-column {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-shrink: 0;
      align-items: center;
    }

    .star-rating {
      position: relative;
      font-size: 1.1rem;
      line-height: 1;
      display: inline-block;
    }

    .star-background {
      color: rgba(255, 255, 255, 0.3);
    }

    .star-fill {
      position: absolute;
      top: 0;
      left: 0;
      color: #ffd700;
      overflow: hidden;
      white-space: nowrap;
    }

    .tempo,
    .duration-info {
      font-size: 0.7rem;
      color: var(--on-theme-color, #ffffff);
      opacity: 0.7;
      line-height: 1.2;
      text-align: center;
    }

    /* Play Stats Column */
    .play-stats {
      display: flex;
      flex-direction: column;
      gap: 3px;
      align-items: center;
      flex-shrink: 0;
    }

    /* Details Column */
    .details-column {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .media-title {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--on-theme-color, #ffffff);
      line-height: 1.2;
    }

    .media-details {
      font-size: 0.75rem;
      color: var(--on-theme-color, #ffffff);
      opacity: 0.8;
      line-height: 1.4;
      word-break: break-word;
      white-space: normal;
    }

    .read-more-link {
      color: var(--on-theme-color, #ffffff);
      text-decoration: underline;
      cursor: pointer;
      font-weight: 500;
      display: inline;
    }

    .read-more-link:hover {
      opacity: 0.7;
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .media-container {
        gap: 16px;
        padding: 14px 20px;
      }

      .album-art {
        width: 56px;
        height: 56px;
      }

      .star-rating {
        font-size: 1.2rem;
      }

      .play-stats {
        gap: 4px;
      }

      .play-circle {
        width: 28px;
        height: 28px;
        font-size: 0.7rem;
      }

      .media-title {
        font-size: 1rem;
      }

      .media-details {
        font-size: 0.8rem;
      }
    }
  `;

  @property({ type: String }) title = '';
  @property({ type: String }) artist = '';
  @property({ type: String }) album = '';
  @property({ type: String }) genre = '';
  @property({ type: String }) year = '';
  @property({ type: String }) comment = '';
  @property({ type: String }) duration = '';
  @property({ type: Number, reflect: true }) rating = 0;
  @property({ type: String }) tempo = '';
  @property({ type: Number }) playsWeek = 0;
  @property({ type: Number }) playsTotal = 0;
  @property({ type: String }) albumArt = '';
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: Boolean }) expanded = false;

  private _handleClick() {
    this.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: {
          title: this.title,
          artist: this.artist,
          album: this.album,
          genre: this.genre,
          year: this.year,
          comment: this.comment,
          duration: this.duration,
          rating: this.rating,
          tempo: this.tempo,
          playsWeek: this.playsWeek,
          playsTotal: this.playsTotal,
          albumArt: this.albumArt,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _generateStar(rating: number): { fillWidth: string } {
    // Rating is already 0-100, just ensure it's within bounds
    const fillPercentage = Math.min(100, Math.max(0, rating));
    return {
      fillWidth: `${fillPercentage}%`,
    };
  }

  private _formatTempo(): string {
    // Remove "BPM" and just show the number
    return this.tempo.replace(/\s*BPM\s*/i, '').trim();
  }

  private _formatDetails(): string {
    const details = [];

    if (this.artist) details.push(this.artist);
    if (this.album) details.push(this.album);
    if (this.genre) details.push(this.genre);
    if (this.year) details.push(this.year);
    if (this.comment) details.push(this.comment);

    return details.join(' - ');
  }

  private _getMaxCommentLength(): number {
    // Responsive comment truncation based on screen size
    const screenWidth = window.innerWidth;

    if (screenWidth < 576) {
      return 25; // Small screens (mobile)
    } else if (screenWidth < 992) {
      return 60; // Medium screens (tablet)
    } else {
      return 80; // Large screens (desktop)
    }
  }

  private _getFormattedDetailsWithComment(): { text: string; hasMoreToShow: boolean } {
    const maxCommentLength = this._getMaxCommentLength();
    const details = [];

    if (this.artist) details.push(this.artist);
    if (this.album) details.push(this.album);
    if (this.genre) details.push(this.genre);
    if (this.year) details.push(this.year);

    let detailsStr = details.join(' - ');
    let hasMoreToShow = false;
    let commentText = this.comment;

    if (this.comment) {
      // Check if comment is too long to determine if we need read more/less
      hasMoreToShow = this.comment.length > maxCommentLength;

      // Only truncate if not expanded
      if (!this.expanded && hasMoreToShow) {
        commentText = this.comment.substring(0, maxCommentLength);
      }
      if (detailsStr) {
        detailsStr += ' - ' + commentText;
      } else {
        detailsStr = commentText;
      }
    }

    return { text: detailsStr, hasMoreToShow };
  }

  private _handleReadMore(event: Event) {
    event.stopPropagation();
    this.expanded = true;
  }

  private _handleReadLess(event: Event) {
    event.stopPropagation();
    this.expanded = false;
  }

  render() {
    const starData = this._generateStar(this.rating);
    const { text, hasMoreToShow } = this._getFormattedDetailsWithComment();

    return html`
      <div class="media-container ${this.active ? 'active' : ''}" @click=${this._handleClick}>
        <div class="album-art">
          ${this.albumArt ? html`<img src="${this.albumArt}" alt="Album art" />` : html`♪`}
        </div>

        <div class="info-column">
          <div class="star-rating">
            <span class="star-background">★</span>
            <span class="star-fill" style="width: ${starData.fillWidth}">★</span>
          </div>
          ${this.tempo ? html`<div class="tempo">${this._formatTempo()}</div>` : ''}
          <div class="duration-info">${this.duration}</div>
        </div>

        <div class="play-stats">
          <t-number-label variant="week" .value=${this.playsWeek}></t-number-label>
          <t-number-label variant="total" .value=${this.playsTotal}></t-number-label>
        </div>

        <div class="details-column">
          <div class="media-title">${this.title}</div>
          <div class="media-details">
            ${text}
            ${hasMoreToShow && !this.expanded
              ? html`<span class="read-more-link" @click=${this._handleReadMore}
                  >... read more</span
                >`
              : ''}
            ${hasMoreToShow && this.expanded
              ? html`<span class="read-more-link" @click=${this._handleReadLess}> read less</span>`
              : ''}
          </div>
        </div>
      </div>
    `;
  }
}
