import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-media.js';

interface GenreGroup {
  genre: string;
  tracks: any[];
}

@customElement('t-genre-list')
export class GenreList extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .genre-list-container {
      padding: 0;
    }

    .genre-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .genre-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .genre-info {
      flex: 1;
    }

    .genre-name {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--on-theme-color, #ffffff);
      margin-bottom: 4px;
    }

    .genre-track-count {
      font-size: 0.8rem;
      color: var(--on-theme-color, #ffffff);
      opacity: 0.7;
    }

    .detail-view {
      padding: 0;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background-color: rgba(255, 255, 255, 0.05);
    }

    .back-arrow {
      font-size: 1.2rem;
      cursor: pointer;
      color: var(--on-theme-color, #ffffff);
    }

    .detail-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--on-theme-color, #ffffff);
      margin: 0;
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .genre-item {
        padding: 14px 20px;
      }

      .genre-name {
        font-size: 1rem;
      }

      .detail-header {
        padding: 14px 20px;
      }

      .detail-title {
        font-size: 1.1rem;
      }
    }
  `;

  @property({ type: Array }) tracks: any[] = [];
  @property({ type: String }) selectedGenre: string = '';

  private _getGenreGroups(): GenreGroup[] {
    const groups = new Map<string, any[]>();

    this.tracks.forEach((track) => {
      const genre = track.genre || 'Unknown';
      if (!groups.has(genre)) {
        groups.set(genre, []);
      }
      groups.get(genre)!.push(track);
    });

    return Array.from(groups.entries())
      .map(([genre, tracks]) => ({ genre, tracks }))
      .sort((a, b) => a.genre.localeCompare(b.genre));
  }

  private _handleGenreClick(genre: string) {
    this.selectedGenre = genre;
  }

  private _handleBack() {
    this.selectedGenre = '';
  }

  private _handleMediaSelected(event: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('track-selected', {
        detail: { track: event.detail },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const isDetailView = this.selectedGenre !== '';
    const genreGroups = this._getGenreGroups();
    const selectedGroup = genreGroups.find((g) => g.genre === this.selectedGenre);

    if (isDetailView && selectedGroup) {
      return html`
        <div class="detail-view">
          <div class="detail-header">
            <span class="back-arrow" @click=${this._handleBack}>←</span>
            <h2 class="detail-title">${this.selectedGenre}</h2>
          </div>
          ${selectedGroup.tracks.map(
            (track) => html`
              <t-media
                title=${track.title}
                artist=${track.artist}
                album=${track.album}
                genre=${track.genre}
                year=${track.year}
                comment=${track.comment}
                duration=${track.duration}
                .rating=${track.rating}
                tempo=${track.tempo}
                .playsWeek=${track.playsWeek}
                .playsTotal=${track.playsTotal}
                @media-selected=${this._handleMediaSelected}
              ></t-media>
            `
          )}
        </div>
      `;
    }

    return html`
      <div class="genre-list-container">
        ${genreGroups.map(
          (group) => html`
            <div class="genre-item" @click=${() => this._handleGenreClick(group.genre)}>
              <div class="genre-info">
                <div class="genre-name">${group.genre}</div>
                <div class="genre-track-count">
                  ${group.tracks.length} track${group.tracks.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
