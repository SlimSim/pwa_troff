import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-track-list.js';
import './t-artist-list.js';
import './t-genre-list.js';
import './t-group-list.js';
import './t-media-footer.js';
import '../atom/t-butt.js';
import '../atom/t-dropdown-button.js';
import { LocalSongDataService } from '../../utils/local-song-data.js';
import type { TroffFirebaseGroupIdentifyer } from '../../types/troff.js';
import { nDB } from '../../assets/internal/db.js';
import { getCurrentSongKey } from '../../utils/current-song.js';

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
  @property({ type: Array }) private songs: any[] = [];
  @property({ type: Array }) private groups: TroffFirebaseGroupIdentifyer[] = [];
  @property({ type: String }) currentSongKey = '';

  // Add lifecycle method to load songs
  async connectedCallback() {
    super.connectedCallback();
    await this._loadSongs();
    this.currentSongKey = getCurrentSongKey() || '';
    this.addEventListener('media-selected', (e: any) => {
      this.currentSongKey = e.detail.songKey || '';
      this.requestUpdate(); // Force re-render to update active states
    });
  }

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

  private _handleClose() {
    this.visible = false;
    this.dispatchEvent(
      new CustomEvent('song-list-closed', {
        bubbles: true,
        composed: true,
      })
    );
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
        class="sort-option-item ${this.sortBy === 'playsWeek' ? 'active' : ''}"
        @click=${() => this._handleSortOption('playsWeek')}
      >
        By Plays (Week)
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

    const groups = this.groups.map((group) => ({
      ...group,
      tracks: songs.filter((song) =>
        group.songs.some(
          (groupSong) => groupSong.fullPath === song.songKey || groupSong.galleryId === song.songKey
        )
      ),
    }));

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
                <t-butt icon @click=${this._handleSearchSongs} title="Search songs">
                  <t-icon name="note-search"></t-icon>
                </t-butt>
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
              </div>
            `
          : ''}
      </div>

      <div class="songs-container">
        ${this.currentFilter === 'tracks'
          ? html`
              <t-track-list
                .tracks=${this._getSortedSongs(songs)}
                currentSongKey=${this.currentSongKey}
              ></t-track-list>
            `
          : ''}
        ${this.currentFilter === 'artists'
          ? html`
              <t-artist-list
                .artists=${this._getSortedArtists(songs)}
                .tracks=${songs}
                currentSongKey=${this.currentSongKey}
              ></t-artist-list>
            `
          : ''}
        ${this.currentFilter === 'genre'
          ? html`
              <t-genre-list
                .genres=${this._getSortedGenres(songs)}
                .tracks=${songs}
                currentSongKey=${this.currentSongKey}
              ></t-genre-list>
            `
          : ''}
        ${this.currentFilter === 'groups'
          ? html`
              <t-group-list
                .groups=${this._getSortedGroups(groups)}
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
