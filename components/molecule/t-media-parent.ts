import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-track-list.js';
import './t-artist-list.js';
import './t-genre-list.js';
import './t-group-list.js';
import './t-media-footer.js';
import '../atom/t-butt.js';
import '../atom/t-dropdown-button.js';
import '../atom/t-input.js';
import type { TInput } from '../atom/t-input.js';
import { LocalSongDataService } from '../../utils/local-song-data.js';
import type { TroffFirebaseGroupIdentifyer } from '../../types/troff.js';
import { nDB } from '../../assets/internal/db.js';
import { getCurrentSongKey } from '../../utils/current-song.js';
import {
  filterTracks,
  filterArtists,
  filterGenres,
  filterGroups,
} from '../../utils/media-search.js';
import type { TrackLike } from '../../utils/media-search.js';
import log from '../../utils/log.js';

// Module-level diagnostic listener: registers at module load time to verify
// whether the Esc keydown reaches the window at all. This bypasses any
// component lifecycle issues with connectedCallback registration.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      console.log('[t-media-parent MODULE] Esc keydown on window', {
        key: event.key,
        target: (event.target as Element | null)?.tagName,
        activeElement: (document.activeElement as Element | null)?.tagName,
      });
    }
  });
}

@customElement('t-media-parent')
export class MediaParent extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: -100%;
      left: 0;
      right: 0;
      background-color: var(--tertiary-color);
      color: var(--on-primary-color);
      z-index: 999;
      transition: transform 0.3s ease-in-out;
      height: 100%;
      overflow-y: auto;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    :host([visible]) {
      transform: translateY(100%);
    }

    .song-list-header {
      /* background: color-mix(in srgb, currentColor 5%, transparent); */
      padding: 16px;
      border-bottom: 1px solid var(--theme-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .song-list-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .search-input {
      display: block;
      max-width: 160px;
      min-width: 100px;
    }

    /* On wider screens there's room for a more comfortable search input width. */
    @media (min-width: 576px) {
      .search-input {
        max-width: 200px;
      }
    }

    .song-count {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .sort-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      background-color: var(--theme-color, #003366);
      border: 1px solid var(--on-theme-color, #ffffff);
      border-radius: 4px;
      margin-top: 4px;
      z-index: 1000;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .sort-option-item {
      padding: 10px 16px;
      cursor: pointer;
      border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      font-size: 0.9rem;
      transition: background-color 0.2s ease;
    }

    .sort-option-item:last-child {
      border-bottom: none;
    }

    .sort-option-item:hover {
      background-color: color-mix(in srgb, currentColor 10%, transparent);
    }

    .sort-option-item.active {
      background-color: color-mix(in srgb, currentColor 14%, transparent);
      font-weight: 600;
    }
    .sort-option-item.active:hover {
      background-color: color-mix(in srgb, currentColor 20%, transparent);
    }

    .sort-order-container {
      display: flex;
      gap: 0;
      border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    }

    .sort-order-container .sort-option-item {
      flex: 1;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      border-right: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    }

    .sort-order-container .sort-option-item:last-child {
      border-right: none;
    }

    .songs-container {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .song-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .song-item:hover {
      background-color: color-mix(in srgb, currentColor 10%, transparent);
    }

    .song-item.active {
      background-color: color-mix(in srgb, currentColor 20%, transparent);
    }

    .song-info {
      flex: 1;
      min-width: 0;
    }

    .song-title {
      font-size: 0.95rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .song-artist {
      font-size: 0.8rem;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-duration {
      font-size: 0.75rem;
      opacity: 0.6;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .song-list-header {
        padding: 12px;
      }

      .song-item {
        padding: 10px 12px;
      }

      .song-title {
        font-size: 0.9rem;
      }

      .song-artist {
        font-size: 0.75rem;
      }

      .song-duration {
        font-size: 0.7rem;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) visible = false;
  @property({ type: String }) currentFilter = 'tracks';
  @property({ type: String }) sortBy = 'title';
  @property({ type: String }) sortOrder = 'ascending';
  @property({ type: Boolean }) showSortDropdown = false;
  @property({ type: String }) groupSortBy = 'name';
  @property({ type: String }) groupSortOrder = 'ascending';
  @property({ type: Boolean }) showGroupSortDropdown = false;
  @property({ type: String }) artistSortBy = 'name';
  @property({ type: String }) artistSortOrder = 'ascending';
  @property({ type: Boolean }) showArtistSortDropdown = false;
  @property({ type: String }) genreSortBy = 'name';
  @property({ type: String }) genreSortOrder = 'ascending';
  @property({ type: Boolean }) showGenreSortDropdown = false;
  @property({ type: String }) searchQuery = '';
  @property({ type: Boolean }) isDesktop = false;
  @property({ type: Number }) highlightedIndex = -1;
  @property({ type: Boolean, state: true })
  isSearchFocused = false;
  @property({ type: Array }) private songs: any[] = [];
  @property({ type: Array }) private groups: TroffFirebaseGroupIdentifyer[] = [];
  @property({ type: String }) currentSongKey = '';

  // Add lifecycle method to load songs
  async connectedCallback() {
    super.connectedCallback();
    this.isDesktop = window.matchMedia('(pointer: fine)').matches;
    await this._loadSongs();
    this.currentSongKey = getCurrentSongKey() || '';
    this.addEventListener('media-selected', (e: any) => {
      this.currentSongKey = e.detail.songKey || '';
      this.requestUpdate(); // Force re-render to update active states
      this.visible = false; // Close the song list panel
    });
    window.addEventListener('keydown', this._handleGlobalKeydown);
    window.addEventListener('keydown', this._handleGlobalEsc);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._handleGlobalKeydown);
    window.removeEventListener('keydown', this._handleGlobalEsc);
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('visible') && !this.visible) {
      this.dispatchEvent(
        new CustomEvent('song-list-closed', {
          bubbles: true,
          composed: true,
        })
      );
    }
    if (changedProperties.has('searchQuery')) {
      const visibleTracks = this._getVisibleTracks();
      this.highlightedIndex = visibleTracks.length > 0 ? 0 : -1;
    }
  }

  // Ctrl/Cmd+F opens the song view and focuses the search input.
  // Esc clears the search input — handled here (not on the <t-input> keydown)
  // because in some browsers the Esc keydown does not cross the shadow DOM
  // boundary to the host element, but the window listener always fires.
  private _handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      if (!this.visible) {
        this.visible = true;
      }
      void this.updateComplete.then(() => {
        const tInput = this.shadowRoot?.querySelector<TInput>('t-input.search-input');
        if (!tInput) return;
        tInput.focus();
        if (this.searchQuery) {
          tInput.select();
        }
      });
      return;
    }
    if (event.key === 'Escape' && this.isSearchFocused) {
      log.d('Esc pressed in search input');
      event.preventDefault();
      this.searchQuery = '';
      this._blurSearchInput();
    }
  };

  // Dedicated global Esc handler — blurs any active field. Separate from
  // _handleGlobalKeydown (which also handles Ctrl+F and search-specific Esc
  // behavior) so we can verify it fires independently.
  private _handleGlobalEsc = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    console.log('[t-media-parent] Global Esc handler fired', {
      key: event.key,
      activeElement: document.activeElement?.tagName,
      activeElementId: (document.activeElement as HTMLElement)?.id,
    });
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && activeElement !== document.body) {
      activeElement.blur();
    }
  };

  // Add method to load songs
  private async _loadSongs() {
    try {
      this.songs = await LocalSongDataService.getAllSongs();

      // Load groups from localStorage
      const songLists = nDB.get('aoSongLists') || [];
      this.groups = songLists;

      this.requestUpdate();
    } catch (error) {
      console.error('Failed to load songs and groups:', error);
      this.songs = [];
      this.groups = [];
    }
  }

  private _getSortedSongs(songs: any[]): any[] {
    const sorted = [...songs];
    sorted.sort((a, b) => {
      let aVal: any = a[this.sortBy as keyof typeof a];
      let bVal: any = b[this.sortBy as keyof typeof b];

      // Handle tempo parsing (extract number from 'XXX BPM' format)
      if (this.sortBy === 'tempo') {
        aVal = parseInt(String(aVal).split(' ')[0], 10);
        bVal = parseInt(String(bVal).split(' ')[0], 10);
      }

      // Handle string comparisons (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      // Compare values
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      // Reverse if descending
      return this.sortOrder === 'descending' ? -comparison : comparison;
    });
    return sorted;
  }

  private _getVisibleTracks(): TrackLike[] {
    return this._getSortedSongs(filterTracks(this.songs, this.searchQuery));
  }

  private _handleFilterChanged(event: CustomEvent) {
    this.currentFilter = event.detail.filter;
  }

  private _handleToggleSortDropdown() {
    this.showSortDropdown = !this.showSortDropdown;
  }

  private _handleSortDropdownToggled(event: CustomEvent) {
    this.showSortDropdown = event.detail.open;
  }

  private _handleSortOption(option: string) {
    this.sortBy = option;
  }

  private _handleSortOrder(order: 'ascending' | 'descending') {
    this.sortOrder = order;
  }

  private _handleAddSong() {
    // Logic to be implemented later
    console.log('Add song button clicked');
  }

  private _handleSearchSongs() {
    // Logic to be implemented later
    console.log('Search songs button clicked');
  }

  private _handleSearchInput(event: Event) {
    // <t-input> dispatches a custom 'input' event with detail = { value, event }
    // AND the original native 'input' event also bubbles out of its shadow DOM.
    // Only react to the custom event (identified by detail being an object with
    // a string `value`); ignore the native InputEvent (detail is a number).
    const detail = (event as CustomEvent).detail;
    if (typeof detail?.value === 'string') {
      this.searchQuery = detail.value;
    }
    const visibleTracks = this._getVisibleTracks();
    this.highlightedIndex = visibleTracks.length > 0 ? 0 : -1;
  }

  private _handleSearchKeydown(event: KeyboardEvent) {
    console.log('[t-media-parent] _handleSearchKeydown fired', {
      key: event.key,
      currentFilter: this.currentFilter,
      isDesktop: this.isDesktop,
      isSearchFocused: this.isSearchFocused,
      searchQuery: this.searchQuery,
      highlightedIndex: this.highlightedIndex,
    });

    if (this.currentFilter !== 'tracks') return;

    // Enter should always load the currently highlighted search result,
    // even on devices where pointer detection is not "fine".
    if (event.key === 'Enter') {
      console.log('[t-media-parent] Enter detected in search input', {
        highlightedIndexBeforeSelect: this.highlightedIndex,
        visibleTrackCount: this._getVisibleTracks().length,
      });
      event.preventDefault();
      this._selectHighlightedTrack();
      console.log('[t-media-parent] Enter path completed', {
        defaultPrevented: event.defaultPrevented,
      });
      return;
    }

    if (!this.isDesktop) {
      console.log('[t-media-parent] Non-Enter key ignored because isDesktop is false', {
        key: event.key,
      });
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const tracks = this._getVisibleTracks();
        if (tracks.length === 0) return;
        const max = tracks.length - 1;
        const direction = event.key;
        console.log('[t-media-parent] Arrow navigation before update', {
          direction,
          highlightedIndexBefore: this.highlightedIndex,
          max,
        });
        if (this.highlightedIndex === -1) {
          this.highlightedIndex = direction === 'ArrowDown' ? 0 : max;
        } else {
          const next = this.highlightedIndex + (direction === 'ArrowDown' ? 1 : -1);
          this.highlightedIndex = Math.max(0, Math.min(max, next));
        }
        console.log('[t-media-parent] Arrow navigation after update', {
          highlightedIndexAfter: this.highlightedIndex,
        });
        break;
      }
      default:
        console.log('[t-media-parent] Key ignored in search handler', {
          key: event.key,
        });
        break;
    }
  }

  private _handleSearchFocus = (): void => {
    this.isSearchFocused = true;
  };

  private _handleSearchBlur = (): void => {
    this.isSearchFocused = false;
  };

  private _blurSearchInput() {
    const tInput = this.shadowRoot?.querySelector<TInput>('t-input.search-input');
    const innerInput = tInput?.shadowRoot?.querySelector<HTMLInputElement>('input');
    innerInput?.blur();
  }

  private _selectHighlightedTrack() {
    const visibleTracks = this._getVisibleTracks();
    const track = visibleTracks[this.highlightedIndex];

    console.log('[t-media-parent] _selectHighlightedTrack called', {
      highlightedIndex: this.highlightedIndex,
      visibleTrackCount: visibleTracks.length,
      visibleTrackSongKeysPreview: visibleTracks.slice(0, 5).map((t) => t.songKey),
      selectedTrackSongKey: track?.songKey,
    });

    if (!track) {
      console.log('[t-media-parent] Selection aborted: no track at highlighted index', {
        highlightedIndex: this.highlightedIndex,
        visibleTrackCount: visibleTracks.length,
      });
      return;
    }

    console.log('[t-media-parent] Dispatching media-selected event', {
      songKey: track.songKey,
      title: track.title,
    });

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

    console.log('[t-media-parent] media-selected event dispatched', {
      songKey: track.songKey,
    });
  }

  private _renderSortDropdown() {
    return html`
      <div class="sort-order-container">
        <div
          class="sort-option-item ${this.sortOrder === 'ascending' ? 'active' : ''}"
          @click=${() => this._handleSortOrder('ascending')}
        >
          Ascending
        </div>
        <div
          class="sort-option-item ${this.sortOrder === 'descending' ? 'active' : ''}"
          @click=${() => this._handleSortOrder('descending')}
        >
          Descending
        </div>
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'title' ? 'active' : ''}"
        @click=${() => this._handleSortOption('title')}
      >
        By Title
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'artist' ? 'active' : ''}"
        @click=${() => this._handleSortOption('artist')}
      >
        By Artist
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'album' ? 'active' : ''}"
        @click=${() => this._handleSortOption('album')}
      >
        By Album
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'genre' ? 'active' : ''}"
        @click=${() => this._handleSortOption('genre')}
      >
        By Genre
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'rating' ? 'active' : ''}"
        @click=${() => this._handleSortOption('rating')}
      >
        By Rating
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'tempo' ? 'active' : ''}"
        @click=${() => this._handleSortOption('tempo')}
      >
        By Tempo
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'playsMonth' ? 'active' : ''}"
        @click=${() => this._handleSortOption('playsMonth')}
      >
        By Plays (Month)
      </div>
      <div
        class="sort-option-item ${this.sortBy === 'playsTotal' ? 'active' : ''}"
        @click=${() => this._handleSortOption('playsTotal')}
      >
        By Plays (Total)
      </div>
    `;
  }

  private _handleGroupSortDropdownToggled(event: CustomEvent) {
    this.showGroupSortDropdown = event.detail.open;
  }

  private _handleGroupSortOption(option: string) {
    this.groupSortBy = option;
  }

  private _handleGroupSortOrder(order: 'ascending' | 'descending') {
    this.groupSortOrder = order;
  }

  private _getSortedGroups(groups: any[]): any[] {
    const sorted = [...groups];
    sorted.sort((a, b) => {
      let aVal: any = a[this.groupSortBy as keyof typeof a];
      let bVal: any = b[this.groupSortBy as keyof typeof b];

      // Handle array length (for track count)
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        aVal = aVal.length;
        bVal = bVal.length;
      }

      // Handle string comparisons (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      // Compare values
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      // Reverse if descending
      return this.groupSortOrder === 'descending' ? -comparison : comparison;
    });
    return sorted;
  }

  private _renderGroupSortDropdown() {
    return html`
      <div class="sort-order-container">
        <div
          class="sort-option-item ${this.groupSortOrder === 'ascending' ? 'active' : ''}"
          @click=${() => this._handleGroupSortOrder('ascending')}
        >
          ${this.groupSortOrder === 'ascending' ? '✓ ' : ''}Ascending
        </div>
        <div
          class="sort-option-item ${this.groupSortOrder === 'descending' ? 'active' : ''}"
          @click=${() => this._handleGroupSortOrder('descending')}
        >
          ${this.groupSortOrder === 'descending' ? '✓ ' : ''}Descending
        </div>
      </div>
      <div class="sort-divider"></div>
      <div
        class="sort-option-item ${this.groupSortBy === 'name' ? 'active' : ''}"
        @click=${() => this._handleGroupSortOption('name')}
      >
        By Name
      </div>
      <div
        class="sort-option-item ${this.groupSortBy === 'tracks' ? 'active' : ''}"
        @click=${() => this._handleGroupSortOption('tracks')}
      >
        By Track Count
      </div>
    `;
  }

  private _handleArtistSortDropdownToggled(event: CustomEvent) {
    this.showArtistSortDropdown = event.detail.open;
  }

  private _handleArtistSortOption(option: string) {
    this.artistSortBy = option;
  }

  private _handleArtistSortOrder(order: 'ascending' | 'descending') {
    this.artistSortOrder = order;
  }

  private _getUniqueArtists(songs: any[]) {
    const artists = new Map();
    songs.forEach((song) => {
      const artist = song.artist || 'Unknown';
      if (!artists.has(artist)) {
        artists.set(artist, []);
      }
      artists.get(artist).push(song);
    });
    return Array.from(artists.entries()).map(([name, tracks]) => ({ name, tracks }));
  }

  private _getSortedArtists(songs: any[]): any[] {
    const artists = this._getUniqueArtists(songs);
    artists.sort((a, b) => {
      let aVal: any = a[this.artistSortBy as keyof typeof a];
      let bVal: any = b[this.artistSortBy as keyof typeof b];

      // Handle array length (for track count)
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        aVal = aVal.length;
        bVal = bVal.length;
      }

      // Handle string comparisons (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      // Compare values
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      // Reverse if descending
      return this.artistSortOrder === 'descending' ? -comparison : comparison;
    });
    return artists;
  }

  private _renderArtistSortDropdown() {
    return html`
      <div class="sort-order-container">
        <div
          class="sort-option-item ${this.artistSortOrder === 'ascending' ? 'active' : ''}"
          @click=${() => this._handleArtistSortOrder('ascending')}
        >
          ${this.artistSortOrder === 'ascending' ? '✓ ' : ''}Ascending
        </div>
        <div
          class="sort-option-item ${this.artistSortOrder === 'descending' ? 'active' : ''}"
          @click=${() => this._handleArtistSortOrder('descending')}
        >
          ${this.artistSortOrder === 'descending' ? '✓ ' : ''}Descending
        </div>
      </div>
      <div class="sort-divider"></div>
      <div
        class="sort-option-item ${this.artistSortBy === 'name' ? 'active' : ''}"
        @click=${() => this._handleArtistSortOption('name')}
      >
        By Name
      </div>
      <div
        class="sort-option-item ${this.artistSortBy === 'tracks' ? 'active' : ''}"
        @click=${() => this._handleArtistSortOption('tracks')}
      >
        By Track Count
      </div>
    `;
  }

  private _handleGenreSortDropdownToggled(event: CustomEvent) {
    this.showGenreSortDropdown = event.detail.open;
  }

  private _handleGenreSortOption(option: string) {
    this.genreSortBy = option;
  }

  private _handleGenreSortOrder(order: 'ascending' | 'descending') {
    this.genreSortOrder = order;
  }

  private _getUniqueGenres(songs: any[]) {
    const genres = new Map();
    songs.forEach((song) => {
      const genre = song.genre || 'Unknown';
      if (!genres.has(genre)) {
        genres.set(genre, []);
      }
      genres.get(genre).push(song);
    });
    return Array.from(genres.entries()).map(([name, tracks]) => ({ name, tracks }));
  }

  private _getSortedGenres(songs: any[]): any[] {
    const genres = this._getUniqueGenres(songs);
    genres.sort((a, b) => {
      let aVal: any = a[this.genreSortBy as keyof typeof a];
      let bVal: any = b[this.genreSortBy as keyof typeof b];

      // Handle array length (for track count)
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        aVal = aVal.length;
        bVal = bVal.length;
      }

      // Handle string comparisons (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      // Compare values
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      // Reverse if descending
      return this.genreSortOrder === 'descending' ? -comparison : comparison;
    });
    return genres;
  }

  private _renderGenreSortDropdown() {
    return html`
      <div class="sort-order-container">
        <div
          class="sort-option-item ${this.genreSortOrder === 'ascending' ? 'active' : ''}"
          @click=${() => this._handleGenreSortOrder('ascending')}
        >
          ${this.genreSortOrder === 'ascending' ? '✓ ' : ''}Ascending
        </div>
        <div
          class="sort-option-item ${this.genreSortOrder === 'descending' ? 'active' : ''}"
          @click=${() => this._handleGenreSortOrder('descending')}
        >
          ${this.genreSortOrder === 'descending' ? '✓ ' : ''}Descending
        </div>
      </div>
      <div class="sort-divider"></div>
      <div
        class="sort-option-item ${this.genreSortBy === 'name' ? 'active' : ''}"
        @click=${() => this._handleGenreSortOption('name')}
      >
        By Name
      </div>
      <div
        class="sort-option-item ${this.genreSortBy === 'tracks' ? 'active' : ''}"
        @click=${() => this._handleGenreSortOption('tracks')}
      >
        By Track Count
      </div>
    `;
  }

  render() {
    const songs = this.songs;
    const query = this.searchQuery;

    // Tracks: filter by title, then sort.
    const visibleTracks = this._getVisibleTracks();

    // Artists / genres: the existing sort helpers take raw songs and compute
    // unique artists/genres internally, so we sort first and then filter the
    // result. The user-visible order (filtered + sorted) is unchanged.
    const visibleArtists = filterArtists(this._getSortedArtists(songs), query);
    const visibleGenres = filterGenres(this._getSortedGenres(songs), query);

    // Groups: filter the raw group list by name, then map each group to its
    // tracks, then sort. Filtering against the raw list (before mapping) keeps
    // the name comparison against the source-of-truth value.
    const visibleGroups = this._getSortedGroups(
      filterGroups(this.groups, query).map((group) => ({
        ...group,
        tracks: songs.filter((song) =>
          group.songs.some(
            (groupSong) =>
              groupSong.fullPath === song.songKey || groupSong.galleryId === song.songKey
          )
        ),
      }))
    );

    return html`
      <div class="song-list-header">
        <h3 class="song-list-title">Song List</h3>

        ${this.currentFilter === 'tracks'
          ? html`
              <div class="header-controls">
                <!-- Add Songs Button -->
                <t-butt icon @click=${this._handleAddSong} title="Add songs">
                  <t-icon name="note-plus"></t-icon>
                </t-butt>

                <!-- Song Count -->
                <div class="song-count"><t-icon name="note"></t-icon> ${songs.length}</div>

                <!-- Sort/Filter Button with Dropdown -->
                <t-dropdown-button
                  .open=${this.showSortDropdown}
                  @dropdown-toggled=${this._handleSortDropdownToggled}
                >
                  <t-butt icon slot="button" title="Sort options">
                    <t-icon name="sort"></t-icon>
                  </t-butt>
                  <div slot="dropdown">${this._renderSortDropdown()}</div>
                </t-dropdown-button>

                <!-- Search Songs Button -->
                <t-butt
                  href="/find.html"
                  target="_blank"
                  icon
                  @click=${this._handleSearchSongs}
                  title="Search songs"
                >
                  <t-icon name="note-search"></t-icon>
                </t-butt>

                <!-- Search Tracks Input -->
                <t-input
                  class="search-input"
                  slim
                  clearable
                  placeholder="Search tracks…"
                  aria-label="Search tracks…"
                  .value=${this.searchQuery}
                  @input=${this._handleSearchInput}
                  @keydown=${this._handleSearchKeydown}
                  @focus=${this._handleSearchFocus}
                  @blur=${this._handleSearchBlur}
                ></t-input>
              </div>
            `
          : ''}
        ${this.currentFilter === 'artists'
          ? html`
              <div class="header-controls">
                <!-- Add Artist Button -->
                <t-butt icon @click=${this._handleAddSong} title="Add artist">
                  <t-icon name="note-plus"></t-icon>
                </t-butt>

                <!-- Artist Count -->
                <div class="song-count">
                  <t-icon name="note"></t-icon> ${this._getUniqueArtists(songs).length}
                </div>

                <!-- Sort/Filter Button with Dropdown -->
                <t-dropdown-button
                  .open=${this.showArtistSortDropdown}
                  @dropdown-toggled=${this._handleArtistSortDropdownToggled}
                >
                  <t-butt icon slot="button" title="Sort options">
                    <t-icon name="sort"></t-icon>
                  </t-butt>
                  <div slot="dropdown">${this._renderArtistSortDropdown()}</div>
                </t-dropdown-button>

                <!-- Search Artists Input -->
                <t-input
                  class="search-input"
                  slim
                  clearable
                  placeholder="Search artists…"
                  aria-label="Search artists…"
                  .value=${this.searchQuery}
                  @input=${this._handleSearchInput}
                  @keydown=${this._handleSearchKeydown}
                  @focus=${this._handleSearchFocus}
                  @blur=${this._handleSearchBlur}
                ></t-input>
              </div>
            `
          : ''}
        ${this.currentFilter === 'genre'
          ? html`
              <div class="header-controls">
                <!-- Add Genre Button -->
                <t-butt icon @click=${this._handleAddSong} title="Add genre">
                  <t-icon name="note-plus"></t-icon>
                </t-butt>

                <!-- Genre Count -->
                <div class="song-count">
                  <t-icon name="note"></t-icon> ${this._getUniqueGenres(songs).length}
                </div>

                <!-- Sort/Filter Button with Dropdown -->
                <t-dropdown-button
                  .open=${this.showGenreSortDropdown}
                  @dropdown-toggled=${this._handleGenreSortDropdownToggled}
                >
                  <t-butt icon slot="button" title="Sort options">
                    <t-icon name="sort"></t-icon>
                  </t-butt>
                  <div slot="dropdown">${this._renderGenreSortDropdown()}</div>
                </t-dropdown-button>

                <!-- Search Genres Input -->
                <t-input
                  class="search-input"
                  slim
                  clearable
                  placeholder="Search genres…"
                  aria-label="Search genres…"
                  .value=${this.searchQuery}
                  @input=${this._handleSearchInput}
                  @keydown=${this._handleSearchKeydown}
                  @focus=${this._handleSearchFocus}
                  @blur=${this._handleSearchBlur}
                ></t-input>
              </div>
            `
          : ''}
        ${this.currentFilter === 'groups'
          ? html`
              <div class="header-controls">
                <!-- Add Group Button -->
                <t-butt icon @click=${this._handleAddSong} title="Add group">
                  <t-icon name="group-plus"></t-icon>
                </t-butt>

                <!-- Group Count -->
                <div class="song-count"><t-icon name="note"></t-icon> ${this.groups.length}</div>

                <!-- Sort/Filter Button with Dropdown -->
                <t-dropdown-button
                  .open=${this.showGroupSortDropdown}
                  @dropdown-toggled=${this._handleGroupSortDropdownToggled}
                >
                  <t-butt icon slot="button" title="Sort options">
                    <t-icon name="sort"></t-icon>
                  </t-butt>
                  <div slot="dropdown">${this._renderGroupSortDropdown()}</div>
                </t-dropdown-button>

                <!-- Search Groups Input -->
                <t-input
                  class="search-input"
                  slim
                  clearable
                  placeholder="Search groups…"
                  aria-label="Search groups…"
                  .value=${this.searchQuery}
                  @input=${this._handleSearchInput}
                  @keydown=${this._handleSearchKeydown}
                  @focus=${this._handleSearchFocus}
                  @blur=${this._handleSearchBlur}
                ></t-input>
              </div>
            `
          : ''}
      </div>

      <div class="songs-container">
        ${this.currentFilter === 'tracks'
          ? html`
              <t-track-list
                .tracks=${visibleTracks}
                .highlightedIndex=${this.isSearchFocused ? this.highlightedIndex : -1}
                currentSongKey=${this.currentSongKey}
              ></t-track-list>
            `
          : ''}
        ${this.currentFilter === 'artists'
          ? html`
              <t-artist-list
                .artists=${visibleArtists}
                .tracks=${songs}
                currentSongKey=${this.currentSongKey}
              ></t-artist-list>
            `
          : ''}
        ${this.currentFilter === 'genre'
          ? html`
              <t-genre-list
                .genres=${visibleGenres}
                .tracks=${songs}
                currentSongKey=${this.currentSongKey}
              ></t-genre-list>
            `
          : ''}
        ${this.currentFilter === 'groups'
          ? html`
              <t-group-list
                .groups=${visibleGroups}
                .tracks=${songs}
                currentSongKey=${this.currentSongKey}
              ></t-group-list>
            `
          : ''}
      </div>

      <t-media-footer
        .selected=${this.currentFilter}
        @filter-changed=${this._handleFilterChanged}
      ></t-media-footer>
    `;
  }
}
