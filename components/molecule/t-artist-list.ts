import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-media.js';
import '../atom/t-butt.js';

interface ArtistGroup {
  artist: string;
  tracks: any[];
}

@customElement('t-artist-list')
export class ArtistList extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .artist-list-container {
      padding: 0;
    }

    .artist-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .artist-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .artist-info {
      flex: 1;
    }

    .artist-name {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--on-theme-color, #ffffff);
      margin-bottom: 4px;
    }

    .artist-track-count {
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
      .artist-item {
        padding: 14px 20px;
      }

      .artist-name {
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
  @property({ type: String }) selectedArtist: string = '';

  private _getArtistGroups(): ArtistGroup[] {
    const groups = new Map<string, any[]>();

    this.tracks.forEach((track) => {
      const artist = track.artist || 'Unknown';
      if (!groups.has(artist)) {
        groups.set(artist, []);
      }
      groups.get(artist)!.push(track);
    });

    return Array.from(groups.entries())
      .map(([artist, tracks]) => ({ artist, tracks }))
      .sort((a, b) => a.artist.localeCompare(b.artist));
  }

  private _handleArtistClick(artist: string) {
    this.selectedArtist = artist;
  }

  private _handleBack() {
    this.selectedArtist = '';
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
    const isDetailView = this.selectedArtist !== '';
    const artistGroups = this._getArtistGroups();
    const selectedGroup = artistGroups.find((g) => g.artist === this.selectedArtist);

    if (isDetailView && selectedGroup) {
      return html`
        <div class="detail-view">
          <div class="detail-header">
            <span class="back-arrow" @click=${this._handleBack}>←</span>
            <h2 class="detail-title">${this.selectedArtist}</h2>
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
      <div class="artist-list-container">
        ${artistGroups.map(
          (group) => html`
            <div class="artist-item" @click=${() => this._handleArtistClick(group.artist)}>
              <div class="artist-info">
                <div class="artist-name">${group.artist}</div>
                <div class="artist-track-count">
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
