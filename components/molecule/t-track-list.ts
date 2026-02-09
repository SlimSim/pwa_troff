import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-media.js';

@customElement('t-track-list')
export class TrackList extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .tracks-container {
      padding: 0;
    }
  `;

  @property({ type: Array }) tracks: any[] = [];

  render() {
    return html`
      <div class="tracks-container">
        ${this.tracks.map(
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
              .songKey=${track.songKey}
            ></t-media>
          `
        )}
      </div>
    `;
  }
}
