import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-track-list.js';
import './t-artist-list.js';
import './t-genre-list.js';
import './t-group-list.js';
import './t-media-footer.js';
import '../atom/t-butt.js';
import '../atom/t-dropdown-button.js';

@customElement('t-media-parent')
export class MediaParent extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: -100%;
      left: 0;
      right: 0;
      background-color: var(--theme-color, #003366);
      color: var(--on-theme-color, #ffffff);
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
      padding: 16px;
      border-bottom: 1px solid var(--on-theme-color, #ffffff);
      background-color: rgba(255, 255, 255, 0.1);
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
      color: var(--on-theme-color, #ffffff);
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
      color: var(--on-theme-color, #ffffff);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .song-artist {
      font-size: 0.8rem;
      color: var(--on-theme-color, #ffffff);
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-duration {
      font-size: 0.75rem;
      color: var(--on-theme-color, #ffffff);
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

  private _handleTrackSelected(event: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('song-selected', {
        detail: { song: event.detail },
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
    const mockSongs = [
      {
        id: 1,
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        genre: 'Rock',
        year: '1975',
        comment:
          'Epic masterpiece by Queen. This song combines rock and opera elements. It also features intricate harmonies and a memorable guitar solo by Brian May. Furthermore, it has become one of the most iconic songs in rock history.',
        duration: '4:20',
        rating: 95,
        tempo: '120 BPM',
        playsWeek: 3,
        playsTotal: 47,
      },
      {
        id: 2,
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        album: 'Led Zeppelin IV',
        genre: 'Rock',
        year: '1971',
        comment:
          'Classic rock anthem with legendary guitar solo by Jimmy Page. This song is known for its progressive structure, starting with a gentle acoustic intro and building up to a powerful climax. The lyrics are often interpreted as a spiritual journey and a metaphor for the American Dream. It remains a staple in rock music and is frequently cited as one of the greatest rock songs of all time.',
        duration: '6:45',
        rating: 88,
        tempo: '82 BPM',
        playsWeek: 1,
        playsTotal: 23,
      },
      {
        id: 3,
        title: 'Hotel California',
        artist: 'Eagles',
        album: 'Hotel California',
        genre: 'Rock',
        year: '1976',
        comment: 'Mysterious lyrics',
        duration: '3:32',
        rating: 75,
        tempo: '75 BPM',
        playsWeek: 2,
        playsTotal: 31,
      },
      {
        id: 4,
        title: "Sweet Child O' Mine",
        artist: "Guns N' Roses",
        album: 'Appetite for Destruction',
        genre: 'Hard Rock',
        year: '1987',
        comment: 'Iconic guitar riff',
        duration: '3:38',
        rating: 92,
        tempo: '125 BPM',
        playsWeek: 5,
        playsTotal: 68,
      },
      {
        id: 5,
        title: 'Imagine',
        artist: 'John Lennon',
        album: 'Imagine',
        genre: 'Pop',
        year: '1971',
        comment: 'Peace anthem',
        duration: '3:05',
        rating: 85,
        tempo: '76 BPM',
        playsWeek: 2,
        playsTotal: 34,
      },
      {
        id: 6,
        title: 'Smells Like Teen Spirit',
        artist: 'Nirvana',
        album: 'Nevermind',
        genre: 'Grunge',
        year: '1991',
        comment: 'Grunge anthem',
        duration: '2:31',
        rating: 78,
        tempo: '116 BPM',
        playsWeek: 4,
        playsTotal: 52,
      },
      {
        id: 7,
        title: 'Back in Black',
        artist: 'AC/DC',
        album: 'Back in Black',
        genre: 'Hard Rock',
        year: '1980',
        comment: 'High energy',
        duration: '3:51',
        rating: 82,
        tempo: '93 BPM',
        playsWeek: 1,
        playsTotal: 19,
      },
      {
        id: 8,
        title: 'Another Brick in the Wall',
        artist: 'Pink Floyd',
        album: 'The Wall',
        genre: 'Progressive Rock',
        year: '1979',
        comment: 'Conceptual piece',
        duration: '6:23',
        rating: 90,
        tempo: '104 BPM',
        playsWeek: 0,
        playsTotal: 15,
      },
    ];

    const mockGroups = [
      {
        id: 'workout',
        name: 'Workout Mix',
        tracks: mockSongs.filter((song, index) => index % 2 === 0),
      },
      {
        id: 'chill',
        name: 'Chill Vibes',
        tracks: mockSongs.filter((song, index) => index % 3 === 0),
      },
      {
        id: 'rock-classics',
        name: 'Rock Classics',
        tracks: mockSongs.filter((song) => song.genre === 'Rock'),
      },
    ];

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
                <div class="song-count"><t-icon name="note"></t-icon> ${mockSongs.length}</div>

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
                  <t-icon name="note"></t-icon> ${this._getUniqueArtists(mockSongs).length}
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
                  <t-icon name="note"></t-icon> ${this._getUniqueGenres(mockSongs).length}
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
                <div class="song-count"><t-icon name="note"></t-icon> ${mockGroups.length}</div>

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
                .tracks=${this._getSortedSongs(mockSongs)}
                @track-selected=${this._handleTrackSelected}
              ></t-track-list>
            `
          : ''}
        ${this.currentFilter === 'artists'
          ? html`
              <t-artist-list
                .artists=${this._getSortedArtists(mockSongs)}
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-artist-list>
            `
          : ''}
        ${this.currentFilter === 'genre'
          ? html`
              <t-genre-list
                .genres=${this._getSortedGenres(mockSongs)}
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-genre-list>
            `
          : ''}
        ${this.currentFilter === 'groups'
          ? html`
              <t-group-list
                .groups=${this._getSortedGroups(mockGroups)}
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
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
