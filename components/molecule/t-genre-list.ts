import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-media.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-input.js';

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

    .genre-item.highlighted {
      border-left: 4px solid var(--accent-color-1, #431c5d);
      background-color: color-mix(
        in srgb,
        var(--accent-color-1, #431c5d) 18%,
        transparent
      );
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--accent-color-1, #431c5d) 45%, transparent);
    }

    .genre-info {
      flex: 1;
    }

    .genre-name {
      font-size: 0.95rem;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .genre-track-count {
      font-size: 0.8rem;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .back-arrow t-icon {
      transform: rotate(-90deg);
      font-size: 1.3rem;
    }

    .detail-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }

    .detail-category-label {
      font-size: 0.65rem;
      opacity: 0.5;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }

    .detail-title-group {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    /* Controls section in the detail header */
    .detail-header-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 1;
      min-width: 0;
      overflow: hidden;
      transition: gap 0.2s ease;
    }

    .detail-header-controls.search-expanded {
      gap: 0;
    }

    .genre-song-count {
      font-size: 0.85rem;
      opacity: 0.8;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 3px;
      transition: opacity 0.2s ease, width 0.2s ease, margin 0.2s ease;
      flex-shrink: 0;
    }

    .genre-song-count.search-expanded {
      opacity: 0;
      width: 0;
      margin: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .detail-add-song-btn {
      flex-shrink: 0;
      transition: opacity 0.2s ease, width 0.2s ease, margin 0.2s ease;
    }

    .detail-add-song-btn.search-expanded {
      opacity: 0;
      width: 0;
      margin: 0;
      overflow: hidden;
      pointer-events: none;
    }

    /* Compact search input that expands on focus */
    .search-compact-wrap {
      display: flex;
      align-items: center;
      overflow: hidden;
      transition: width 0.3s ease;
      width: 32px;
      flex-shrink: 0;
    }

    .search-compact-wrap.search-expanded {
      width: 160px;
      flex-shrink: 1;
    }

    @media (min-width: 576px) {
      .search-compact-wrap.search-expanded {
        width: 200px;
      }
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
  @property({ type: Array }) genres: any[] = [];
  @property({ type: String }) selectedGenre: string = '';
  @property({ type: String }) currentSongKey = '';

  /** Index of the highlighted item in the list view (-1 = none). */
  @property({ type: Number }) highlightedIndex = -1;

  /** Local search query for filtering tracks inside the genre detail. */
  @state() private _genreTrackSearch = '';

  /** Whether the inline search input is focused (expanded state). */
  @state() private _isSearchFocused = false;

  /** Index of the highlighted track in filtered results (-1 = none). */
  @state() private _highlightedIndex = -1;

  private _getGenreGroups(): GenreGroup[] {
    // Use pre-sorted genres if provided, otherwise generate from tracks
    if (this.genres && this.genres.length > 0) {
      return this.genres.map((genre: any) => ({ genre: genre.name, tracks: genre.tracks }));
    }

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

  /** Public method so t-media-parent can programmatically open a genre. */
  public openGenre(genre: string) {
    if (this.selectedGenre === genre) return;
    this.selectedGenre = genre;
    this._highlightedIndex = -1;
    this._dispatchGenreOpened();
  }

  private _dispatchGenreOpened() {
    this.dispatchEvent(
      new CustomEvent('genre-detail-opened', {
        detail: { genre: this.selectedGenre },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _dispatchGenreClosed() {
    this.dispatchEvent(
      new CustomEvent('genre-detail-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleGenreClick(genre: string) {
    this.selectedGenre = genre;
    this._dispatchGenreOpened();
  }

  private _handleBack() {
    this.selectedGenre = '';
    this._highlightedIndex = -1;
    this._dispatchGenreClosed();
  }

  /** Handle click on "Add song" button in the detail header. */
  private _handleAddSong() {
    this.dispatchEvent(
      new CustomEvent('add-song-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Handle search input within the genre detail header. */
  private _handleSearchInput(e: CustomEvent) {
    if (e.detail && typeof e.detail.value === 'string') {
      this._genreTrackSearch = e.detail.value;
    }
    // Reset highlight to first result
    const selectedGroup = this._getGenreGroups().find((g) => g.genre === this.selectedGenre);
    if (!selectedGroup) return;
    const query = this._genreTrackSearch.trim().toLowerCase();
    const filtered = query
      ? selectedGroup.tracks.filter((t: any) => (t.title || '').toLowerCase().includes(query))
      : selectedGroup.tracks;
    this._highlightedIndex = filtered.length > 0 ? 0 : -1;
  }

  /** Handle arrow key navigation and Enter in the detail search. */
  private _handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const selectedGroup = this._getGenreGroups().find((g) => g.genre === this.selectedGenre);
      if (!selectedGroup) return;
      const query = this._genreTrackSearch.trim().toLowerCase();
      const filtered = query
        ? selectedGroup.tracks.filter((t: any) => (t.title || '').toLowerCase().includes(query))
        : selectedGroup.tracks;
      if (filtered.length === 0) return;
      const max = filtered.length - 1;
      if (this._highlightedIndex === -1) {
        this._highlightedIndex = e.key === 'ArrowDown' ? 0 : max;
      } else {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        this._highlightedIndex += delta;
        if (this._highlightedIndex > max) this._highlightedIndex = 0;
        if (this._highlightedIndex < 0) this._highlightedIndex = max;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this._highlightedIndex < 0) return;
      const selectedGroup = this._getGenreGroups().find((g) => g.genre === this.selectedGenre);
      if (!selectedGroup) return;
      const query = this._genreTrackSearch.trim().toLowerCase();
      const filtered = query
        ? selectedGroup.tracks.filter((t: any) => (t.title || '').toLowerCase().includes(query))
        : selectedGroup.tracks;
      const track = filtered[this._highlightedIndex];
      if (!track) return;
      this.dispatchEvent(
        new CustomEvent('media-selected', {
          detail: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            genre: track.genre,
            year: track.year,
            comment: track.comment,
            duration: track.duration,
            rating: track.rating,
            tempo: track.tempo,
            playsMonth: track.playsMonth,
            playsTotal: track.playsTotal,
            albumArt: track.albumArt,
            songKey: track.songKey,
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleSearchFocus() {
    this._isSearchFocused = true;
  }

  private _handleSearchBlur() {
    this._isSearchFocused = false;
    this._genreTrackSearch = '';
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('_highlightedIndex')) {
      const highlighted = this.renderRoot.querySelector<HTMLElement>('t-media[highlighted]');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
    if (changedProperties.has('highlightedIndex')) {
      const highlighted = this.renderRoot.querySelector<HTMLElement>('.genre-item.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  render() {
    const isDetailView = this.selectedGenre !== '';
    const genreGroups = this._getGenreGroups();
    const selectedGroup = genreGroups.find((g) => g.genre === this.selectedGenre);

    if (isDetailView && selectedGroup) {
      const trackQuery = this._genreTrackSearch.trim().toLowerCase();
      const filteredTracks = trackQuery
        ? selectedGroup.tracks.filter((t: any) =>
            (t.title || '').toLowerCase().includes(trackQuery)
          )
        : selectedGroup.tracks;

      return html`
        <div class="detail-view">
          <div class="detail-header">
            <span class="back-arrow" @click=${this._handleBack}>
              <t-icon name="chevron-up"></t-icon>
            </span>
            <div class="detail-title-group">
              <span class="detail-category-label">Genres</span>
              <h2 class="detail-title">${this.selectedGenre}</h2>
            </div>

            <!-- Controls: add song, track count, search -->
            <div class="detail-header-controls ${this._isSearchFocused ? 'search-expanded' : ''}">
              <span class="genre-song-count ${this._isSearchFocused ? 'search-expanded' : ''}">
                <t-icon name="note"></t-icon> ${selectedGroup.tracks.length}
              </span>
              <div class="search-compact-wrap ${this._isSearchFocused ? 'search-expanded' : ''}">
                <t-input
                  slim
                  clearable
                  placeholder="Search tracks…"
                  aria-label="Search tracks in genre"
                  .value=${this._genreTrackSearch}
                  @input=${this._handleSearchInput}
                  @keydown=${this._handleSearchKeydown}
                  @focus=${this._handleSearchFocus}
                  @blur=${this._handleSearchBlur}
                ></t-input>
              </div>
              <t-butt
                class="detail-add-song-btn ${this._isSearchFocused ? 'search-expanded' : ''}"
                icon
                @click=${this._handleAddSong}
                title="Add songs"
              >
                <t-icon name="note-plus"></t-icon>
              </t-butt>
            </div>
          </div>
          ${filteredTracks.length === 0 && trackQuery
            ? html`<div style="padding: 16px; opacity: 0.6; font-size: 0.85rem;">
                No tracks match "${this._genreTrackSearch}".
              </div>`
            : filteredTracks.map(
                (track, index) => html`
                  <t-media
                    .active=${track.songKey === this.currentSongKey}
                    ?highlighted=${index === this._highlightedIndex}
                    title=${track.title}
                    artist=${track.artist}
                    album=${track.album}
                    genre=${track.genre}
                    year=${track.year}
                    comment=${track.comment}
                    duration=${track.duration}
                    .rating=${track.rating}
                    tempo=${track.tempo}
                    .playsMonth=${track.playsMonth}
                    .playsTotal=${track.playsTotal}
                    .songKey=${track.songKey}
                  ></t-media>
                `
              )}
        </div>
      `;
    }

    return html`
      <div class="genre-list-container">
        ${genreGroups.map(
          (group, index) => html`
            <div
              class="genre-item ${index === this.highlightedIndex ? 'highlighted' : ''}"
              @click=${() => this._handleGenreClick(group.genre)}
            >
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
