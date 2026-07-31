import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-media.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-input.js';

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

    .artist-item.highlighted {
      border-left: 4px solid var(--accent-color-1, #431c5d);
      background-color: color-mix(
        in srgb,
        var(--accent-color-1, #431c5d) 18%,
        transparent
      );
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--accent-color-1, #431c5d) 45%, transparent);
    }

    .artist-info {
      flex: 1;
    }

    .artist-name {
      font-size: 0.95rem;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .artist-track-count {
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

    .artist-song-count {
      font-size: 0.85rem;
      opacity: 0.8;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 3px;
      transition: opacity 0.2s ease, width 0.2s ease, margin 0.2s ease;
      flex-shrink: 0;
    }

    .artist-song-count.search-expanded {
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
      position: relative;
      display: flex;
      align-items: center;
      overflow: hidden;
      transition: width 0.3s ease;
      width: 32px;
      flex-shrink: 0;
    }

    .search-compact-icon {
      position: absolute;
      /* z-index keeps the icon above the t-input's background (its inner
         .input-wrapper is position: relative). */
      z-index: 1;
      left: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: var(--on-gray-out, #595959);
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .search-compact-wrap.search-expanded {
      width: 160px;
      flex-shrink: 1;
    }

    .search-compact-wrap.search-expanded .search-compact-icon {
      opacity: 0;
    }

    /* On wider screens the search is always expanded (never collapses). */
    @media (min-width: 576px) {
      .detail-header-controls.search-expanded {
        gap: 6px;
      }

      .artist-song-count.search-expanded {
        opacity: 0.8;
        width: auto;
        margin: initial;
        overflow: visible;
        pointer-events: auto;
      }

      .detail-add-song-btn.search-expanded {
        opacity: 1;
        width: auto;
        margin: initial;
        overflow: visible;
        pointer-events: auto;
      }

      .search-compact-wrap {
        width: 200px;
      }

      .search-compact-wrap.search-expanded {
        width: 200px;
      }

      .search-compact-icon {
        display: none;
      }
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
  @property({ type: Array }) artists: any[] = [];
  @property({ type: String }) selectedArtist: string = '';
  @property({ type: String }) currentSongKey = '';

  /** Index of the highlighted item in the list view (-1 = none). */
  @property({ type: Number }) highlightedIndex = -1;

  /** Local search query for filtering tracks inside the artist detail. */
  @state() private _artistTrackSearch = '';

  /** Whether the inline search input is focused (expanded state). */
  @state() private _isSearchFocused = false;

  /** Index of the highlighted track in filtered results (-1 = none). */
  @state() private _highlightedIndex = -1;

  private _getArtistGroups(): ArtistGroup[] {
    // Use pre-sorted artists if provided, otherwise generate from tracks
    if (this.artists && this.artists.length > 0) {
      return this.artists.map((artist: any) => ({ artist: artist.name, tracks: artist.tracks }));
    }

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

  /** Public method so t-media-parent can programmatically open an artist. */
  public openArtist(artist: string) {
    if (this.selectedArtist === artist) return;
    this.selectedArtist = artist;
    this._highlightedIndex = -1;
    this._dispatchArtistOpened();
  }

  private _dispatchArtistOpened() {
    this.dispatchEvent(
      new CustomEvent('artist-detail-opened', {
        detail: { artist: this.selectedArtist },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _dispatchArtistClosed() {
    this.dispatchEvent(
      new CustomEvent('artist-detail-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleArtistClick(artist: string) {
    this.selectedArtist = artist;
    this._dispatchArtistOpened();
  }

  private _handleBack() {
    this.selectedArtist = '';
    this._highlightedIndex = -1;
    this._dispatchArtistClosed();
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

  /** Handle search input within the artist detail header. */
  private _handleSearchInput(e: CustomEvent) {
    if (e.detail && typeof e.detail.value === 'string') {
      this._artistTrackSearch = e.detail.value;
    }
    // Reset highlight to first result
    const selectedGroup = this._getArtistGroups().find((g) => g.artist === this.selectedArtist);
    if (!selectedGroup) return;
    const query = this._artistTrackSearch.trim().toLowerCase();
    const filtered = query
      ? selectedGroup.tracks.filter((t: any) => (t.title || '').toLowerCase().includes(query))
      : selectedGroup.tracks;
    this._highlightedIndex = filtered.length > 0 ? 0 : -1;
  }

  /** Handle arrow key navigation and Enter in the detail search. */
  private _handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const selectedGroup = this._getArtistGroups().find((g) => g.artist === this.selectedArtist);
      if (!selectedGroup) return;
      const query = this._artistTrackSearch.trim().toLowerCase();
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
      const selectedGroup = this._getArtistGroups().find((g) => g.artist === this.selectedArtist);
      if (!selectedGroup) return;
      const query = this._artistTrackSearch.trim().toLowerCase();
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
    // The search only collapses (and thus clears) on small screens.
    if (!this._isWideScreen()) {
      this._artistTrackSearch = '';
    }
  }

  /** True on screens where the search input stays expanded (>= 576px). */
  private _isWideScreen(): boolean {
    return window.matchMedia?.('(min-width: 576px)').matches ?? false;
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('_highlightedIndex')) {
      const highlighted = this.renderRoot.querySelector<HTMLElement>('t-media[highlighted]');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
    if (changedProperties.has('highlightedIndex')) {
      const highlighted = this.renderRoot.querySelector<HTMLElement>('.artist-item.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  render() {
    const isDetailView = this.selectedArtist !== '';
    const artistGroups = this._getArtistGroups();
    const selectedGroup = artistGroups.find((g) => g.artist === this.selectedArtist);

    if (isDetailView && selectedGroup) {
      const trackQuery = this._artistTrackSearch.trim().toLowerCase();
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
              <span class="detail-category-label">Artists</span>
              <h2 class="detail-title">${this.selectedArtist}</h2>
            </div>

            <!-- Controls: add song, track count, search -->
            <div class="detail-header-controls ${this._isSearchFocused ? 'search-expanded' : ''}">
              <span class="artist-song-count ${this._isSearchFocused ? 'search-expanded' : ''}">
                <t-icon name="note"></t-icon> ${selectedGroup.tracks.length}
              </span>
              <div class="search-compact-wrap ${this._isSearchFocused ? 'search-expanded' : ''}">
                <t-icon class="search-compact-icon" name="search" aria-hidden="true"></t-icon>
                <t-input
                  slim
                  clearable
                  placeholder="Search tracks…"
                  aria-label="Search tracks in artist"
                  .value=${this._artistTrackSearch}
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
                No tracks match "${this._artistTrackSearch}".
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
      <div class="artist-list-container">
        ${artistGroups.map(
          (group, index) => html`
            <div
              class="artist-item ${index === this.highlightedIndex ? 'highlighted' : ''}"
              @click=${() => this._handleArtistClick(group.artist)}
            >
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
