import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-track-list.js';
import './t-artist-list.js';
import './t-genre-list.js';
import './t-song-list-footer.js';

@customElement('t-media-list')
export class MediaList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .media-list-container {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      padding-bottom: 60px;
    }
  `;

  @property({ type: Array }) mockSongs: any[] = [];
  @property({ type: String }) currentFilter = 'tracks';

  private _handleFilterChanged(event: CustomEvent) {
    this.currentFilter = event.detail.filter;
  }

  private _handleTrackSelected(event: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('track-selected', {
        detail: { track: event.detail },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="media-list-container">
        ${this.currentFilter === 'tracks'
          ? html`
              <t-track-list
                .tracks=${this.mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-track-list>
            `
          : ''}
        ${this.currentFilter === 'artists'
          ? html`
              <t-artist-list
                .tracks=${this.mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-artist-list>
            `
          : ''}
        ${this.currentFilter === 'genre'
          ? html`
              <t-genre-list
                .tracks=${this.mockSongs}
                @track-selected=${this._handleTrackSelected}
              ></t-genre-list>
            `
          : ''}
        ${this.currentFilter === 'groups'
          ? html`
              <div style="padding: 16px; text-align: center; opacity: 0.6;">
                Groups view coming soon...
              </div>
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
