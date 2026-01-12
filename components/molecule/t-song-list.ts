import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-track-list.js';
import './t-artist-list.js';
import './t-genre-list.js';
import './t-group-list.js';
import './t-song-list-footer.js';

@customElement('t-song-list')
export class SongList extends LitElement {
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

    .close-button {
      background: none;
      border: none;
      color: var(--on-theme-color, #ffffff);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }

    .close-button:hover {
      background-color: rgba(255, 255, 255, 0.2);
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
      background-color: rgba(255, 255, 255, 0.1);
    }

    .song-item.active {
      background-color: rgba(255, 255, 255, 0.2);
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
        <button class="close-button" @click=${this._handleClose}>×</button>
      </div>

      <div class="songs-container">
        ${this.currentFilter === 'tracks'
          ? html`
              <t-track-list
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-track-list>
            `
          : ''}
        ${this.currentFilter === 'artists'
          ? html`
              <t-artist-list
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-artist-list>
            `
          : ''}
        ${this.currentFilter === 'genre'
          ? html`
              <t-genre-list
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-genre-list>
            `
          : ''}
        ${this.currentFilter === 'groups'
          ? html`
              <t-group-list
                .groups=${mockGroups}
                .tracks=${mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-group-list>
            `
          : ''}
      </div>

      <t-song-list-footer
        .selected=${this.currentFilter}
        @filter-changed=${this._handleFilterChanged}
      ></t-song-list-footer>
    `;
  }
}
