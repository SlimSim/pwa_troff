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
  @property({ type: String }) currentSongKey = '';
  @property({ type: Number }) highlightedIndex = -1;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('highlightedIndex')) {
      const highlighted = this.renderRoot.querySelector<HTMLElement>('t-media[highlighted]');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  render() {
    return html`
      <div class="tracks-container">
        ${this.tracks.map(
          (track, index) => html`
            <t-media
              .active=${track.songKey === this.currentSongKey}
              ?highlighted=${index === this.highlightedIndex}
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
}
