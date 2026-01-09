import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
      padding: 8px 0;
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

  private _handleClose() {
    this.visible = false;
    this.dispatchEvent(
      new CustomEvent('song-list-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleSongClick(song: any) {
    this.dispatchEvent(
      new CustomEvent('song-selected', {
        detail: { song },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const mockSongs = [
      { id: 1, title: 'Bohemian Rhapsody', artist: 'Queen', duration: '4:20' },
      { id: 2, title: 'Stairway to Heaven', artist: 'Led Zeppelin', duration: '6:45' },
      { id: 3, title: 'Hotel California', artist: 'Eagles', duration: '3:32' },
      { id: 4, title: "Sweet Child O' Mine", artist: 'Nirvana', duration: '3:38' },
      { id: 5, title: 'Imagine', artist: 'John Lennon', duration: '3:05' },
      { id: 6, title: 'Smells Like Teen Spirit', artist: 'Nirvana', duration: '2:31' },
      { id: 7, title: 'Back in Black', artist: 'AC/DC', duration: '3:51' },
      { id: 8, title: 'Another Brick in the Wall', artist: 'Pink Floyd', duration: '6:23' },
    ];

    return html`
      <div class="song-list-header">
        <h3 class="song-list-title">Song List</h3>
        <button class="close-button" @click=${this._handleClose}>×</button>
      </div>

      <div class="songs-container">
        ${mockSongs.map(
          (song) => html`
            <div class="song-item" @click=${() => this._handleSongClick(song)}>
              <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
                <div class="song-duration">${song.duration}</div>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
