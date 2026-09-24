import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-media.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-input.js';
import './t-detail-header.js';
import './t-header-actions.js';

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
      border-bottom: 1px solid var(--list-border-color, rgba(255, 255, 255, 0.1));
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .genre-item:hover {
      background-color: var(--list-hover-bg, rgba(255, 255, 255, 0.1));
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

    .no-results {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.7;
    }

    .no-results-text {
      margin-bottom: 12px;
      font-size: 0.9rem;
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .genre-item {
        padding: 14px 20px;
      }

      .genre-name {
        font-size: 1rem;
      }
    }
  `;

  @property({ type: Array }) tracks: any[] = [];
  @property({ type: Array }) genres: any[] = [];
  @property({ type: String }) selectedGenre: string = '';
  @property({ type: String }) currentSongKey = '';
  @property({ type: Object }) downloadProgressMap: Record<string, number> = {};
  @property({ type: Object }) uploadProgressMap: Record<string, number> = {};

  /** Index of the highlighted item in the list view (-1 = none). */
  @property({ type: Number }) highlightedIndex = -1;

  /** Local search query for filtering tracks inside the genre detail. */
  @state() private _genreTrackSearch = '';

  /** Whether the inline search input is focused (expanded state). */
  @state() private _isSearchFocused = false;

  /** Index of the highlighted track in filtered results (-1 = none). */
  @state() private _highlightedIndex = -1;

  private _getGenreGroups(): GenreGroup[] {
    // The parent (t-media-parent) always passes the already-filtered genre
    // list; an empty array means the search matched nothing.
    return (this.genres || []).map((genre: any) => ({
      genre: genre.name,
      tracks: genre.tracks,
    }));
  }

  /** Public method so t-media-parent can programmatically open a genre. */
  public openGenre(genre: string) {
    this._genreTrackSearch = '';
    if (this.selectedGenre === genre) return;
    this.selectedGenre = genre;
    this._highlightedIndex = -1;
    this._dispatchGenreOpened();
  }

  /** Public method so t-media-parent can leave the detail view (e.g. on tab switch). */
  public closeDetail() {
    if (this.selectedGenre === '') return;
    this._handleBack();
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
    this._genreTrackSearch = '';
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
  private _handleSearchKeydown(e: CustomEvent) {
    const key = e.detail?.key as string;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault?.();
      const originalEvent = e.detail?.originalEvent as KeyboardEvent | undefined;
      originalEvent?.preventDefault();
      const selectedGroup = this._getGenreGroups().find((g) => g.genre === this.selectedGenre);
      if (!selectedGroup) return;
      const query = this._genreTrackSearch.trim().toLowerCase();
      const filtered = query
        ? selectedGroup.tracks.filter((t: any) => (t.title || '').toLowerCase().includes(query))
        : selectedGroup.tracks;
      if (filtered.length === 0) return;
      const max = filtered.length - 1;
      if (this._highlightedIndex === -1) {
        this._highlightedIndex = key === 'ArrowDown' ? 0 : max;
      } else {
        const delta = key === 'ArrowDown' ? 1 : -1;
        this._highlightedIndex += delta;
        if (this._highlightedIndex > max) this._highlightedIndex = 0;
        if (this._highlightedIndex < 0) this._highlightedIndex = max;
      }
    } else if (key === 'Enter') {
      e.preventDefault?.();
      const originalEvent = e.detail?.originalEvent as KeyboardEvent | undefined;
      originalEvent?.preventDefault();
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
  }

  /** Clear the detail track search (used by the no-results clear button). */
  private _clearDetailSearch() {
    this._genreTrackSearch = '';
    this._highlightedIndex = -1;
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
          <t-detail-header
            entityName=${this.selectedGenre}
            countLabel="songs"
            count=${selectedGroup.tracks.length}
            ?isSearchFocused=${this._isSearchFocused}
            @back=${this._handleBack}
          >
            <t-header-actions
              slot="actions"
              addIcon="note-plus"
              addTitle="Add songs"
              searchPlaceholder="Search tracks…"
              searchValue=${this._genreTrackSearch}
              ?isSearchFocused=${this._isSearchFocused}
              @add-click=${this._handleAddSong}
              @search-input=${this._handleSearchInput}
              @search-keydown=${this._handleSearchKeydown}
              @search-focus=${this._handleSearchFocus}
              @search-blur=${this._handleSearchBlur}
            >
              <!-- re-project sort from parent into the single actions element -->
              <slot slot="sort" name="sort-controls"></slot>
            </t-header-actions>
          </t-detail-header>
          ${filteredTracks.length === 0 && trackQuery
            ? html`
                <div class="no-results">
                  <div class="no-results-text">
                    No tracks match "${this._genreTrackSearch.trim()}".
                  </div>
                  <t-butt class="no-results-clear" slim @click=${this._clearDetailSearch}>
                    Clear search
                  </t-butt>
                </div>
              `
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
                    albumArt=${track.albumArt}
                    .isVideo=${track.isVideo}
                    .playsMonth=${track.playsMonth}
                    .playsTotal=${track.playsTotal}
                    .songKey=${track.songKey}
                    .downloaded=${track.downloaded !== false}
                    .downloadProgress=${this.downloadProgressMap[track.songKey] ?? -2}
                    .uploadProgress=${this.uploadProgressMap[track.songKey] ?? -2}
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
              ?data-current-song=${group.tracks.some(
                (t: { songKey?: string }) => t.songKey === this.currentSongKey
              )}
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
